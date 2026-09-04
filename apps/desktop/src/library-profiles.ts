import type { DesktopBootstrapSettings, DesktopLibraryProfile } from "./contracts";

const PROFILE_PREFIX = "library_profile_";
const LEGACY_PROFILE_ID = "library_profile_legacy_default";
const DEV_FIXTURE_PROFILE_ID = "library_profile_dev_fixture";

/**
 * Library Profile 是 Desktop 本机资料源配置的“整组预设”。
 *
 * 每个 Profile 可以独立保存：
 * - Private Library；
 * - Unified Library Roots；
 * - 高级 Media / NFO Roots；
 * - Shared Packs。
 *
 * Profile 不带任何内容分类含义。除内置开发 Fixture 使用“示例库”外，
 * 新建资料库只使用“资料库 1 / 资料库 2 …”这类中性名称，由用户自行重命名。
 * ffprobe / Web URL 等真正的应用级设置保持全局，不随资料库切换。
 */
export function createLibraryProfileId(): string {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PROFILE_PREFIX}${random}`;
}

/** 用当前路径快照创建 Profile，主要用于旧 Settings 迁移和示例库接入。 */
export function createLibraryProfile(
  settings: DesktopBootstrapSettings,
  id: string,
  name: string,
): DesktopLibraryProfile {
  const now = new Date().toISOString();
  return snapshotLibraryProfile(settings, {
    id,
    name: cleanProfileName(name),
    createdAt: now,
    updatedAt: now,
  });
}

/** 新建一个完全不指向任何路径的资料库。 */
export function createEmptyLibraryProfile(id: string, name: string): DesktopLibraryProfile {
  const now = new Date().toISOString();
  return {
    id,
    name: cleanProfileName(name),
    libraryRoots: [],
    mediaScanPaths: [],
    nfoScanPaths: [],
    sharedPackPaths: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 默认名称永远是无业务含义的“资料库 N”。 */
export function nextLibraryProfileName(
  settings: DesktopBootstrapSettings,
  prefix = "资料库",
): string {
  const names = new Set((settings.libraryProfiles ?? []).map((profile) => profile.name.trim()));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${prefix} ${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${prefix} ${Date.now()}`;
}

/** 开发 Fixture 是唯一允许由 Localogue 主动提供语义名称的内置资料库。 */
export function isDevFixtureLibraryPath(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  return normalized.endsWith("/var/dev-fixture-library")
    || normalized.endsWith("/dev-fixture-library")
    || normalized.endsWith("/example-library");
}

/**
 * 把 V1-24 之前的单组路径 Settings 平滑升级成一个 Profile。
 * 这一步只发生在内存中；真正写回仍通过用户后续保存/切换动作完成。
 */
export function ensureLibraryProfiles(settings: DesktopBootstrapSettings): DesktopBootstrapSettings {
  let profiles = (settings.libraryProfiles ?? []).map(normalizeProfile);

  // 旧开发示例曾叫“示例资料库”，统一缩短成“示例库”。只对 Fixture 路径迁移，
  // 不主动改用户自己给普通资料库起的名字。
  profiles = profiles.map((profile) => isDevFixtureLibraryPath(profile.libraryPath) && profile.name === "示例资料库"
    ? { ...profile, name: "示例库" }
    : profile);

  if (!profiles.length) {
    if (!hasConfiguredLibrarySources(settings)) return { ...settings, libraryProfiles: [] };
    const isFixture = isDevFixtureLibraryPath(settings.libraryPath);
    const profile = createLibraryProfile(
      settings,
      isFixture ? DEV_FIXTURE_PROFILE_ID : LEGACY_PROFILE_ID,
      isFixture ? "示例库" : "资料库 1",
    );
    return applyLibraryProfile({ ...settings, libraryProfiles: [profile] }, profile);
  }

  const currentActive = profiles.find((profile) => profile.id === settings.activeLibraryProfileId);
  if (currentActive) {
    return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, currentActive);
  }

  const matching = profiles.find((profile) => sameLibraryPaths(settings, profile));
  if (matching) return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, matching);

  // 一旦已经存在 Profile，列表就是资料库配置的事实源。active ID 失效时只允许
  // 回退到现有 Profile，绝不能把平面兼容字段再次“迁移”为一个新 Profile。
  // 否则一次旧状态 / 并发保存就可能制造幽灵资料库，甚至让 UI 看起来像列表丢失。
  return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, profiles[0]);
}

export function snapshotLibraryProfile(
  settings: DesktopBootstrapSettings,
  profile: Pick<DesktopLibraryProfile, "id" | "name"> & Partial<DesktopLibraryProfile>,
): DesktopLibraryProfile {
  return {
    id: profile.id,
    name: cleanProfileName(profile.name),
    description: profile.description?.trim() || undefined,
    libraryPath: settings.libraryPath,
    libraryRoots: unique(settings.libraryRoots),
    mediaScanPaths: unique(settings.mediaScanPaths),
    nfoScanPaths: unique(settings.nfoScanPaths),
    sharedPackPaths: unique(settings.sharedPackPaths),
    createdAt: profile.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function applyLibraryProfile(
  settings: DesktopBootstrapSettings,
  profile: DesktopLibraryProfile,
): DesktopBootstrapSettings {
  return {
    ...settings,
    activeLibraryProfileId: profile.id,
    libraryPath: profile.libraryPath,
    libraryRoots: [...profile.libraryRoots],
    mediaScanPaths: [...profile.mediaScanPaths],
    nfoScanPaths: [...profile.nfoScanPaths],
    sharedPackPaths: [...profile.sharedPackPaths],
  };
}

/** 保存 Settings 时，把当前路径状态写回当前 Profile。 */
export function syncActiveLibraryProfile(settings: DesktopBootstrapSettings): DesktopBootstrapSettings {
  const profiles = (settings.libraryProfiles ?? []).map(normalizeProfile);
  if (!profiles.length) {
    return { ...settings, libraryProfiles: [], activeLibraryProfileId: undefined };
  }

  const active = profiles.find((profile) => profile.id === settings.activeLibraryProfileId)
    ?? profiles.find((profile) => sameLibraryPaths(settings, profile))
    ?? profiles[0];

  // active ID 失效时先落到一个真实存在的 Profile。只有原 active 仍然有效时，
  // 当前平面路径字段才被视为设置页尚未保存的编辑，并写回该 Profile。
  const activeWasValid = active.id === settings.activeLibraryProfileId;
  const current = activeWasValid
    ? { ...settings, activeLibraryProfileId: active.id, libraryProfiles: profiles }
    : applyLibraryProfile({ ...settings, libraryProfiles: profiles }, active);

  return {
    ...current,
    libraryProfiles: profiles.map((profile) => (
      profile.id === active.id ? snapshotLibraryProfile(current, active) : profile
    )),
  };
}

export function addLibraryProfile(
  settings: DesktopBootstrapSettings,
  profile: DesktopLibraryProfile,
): DesktopBootstrapSettings {
  const profiles = [...(settings.libraryProfiles ?? []).filter((item) => item.id !== profile.id), normalizeProfile(profile)];
  return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, normalizeProfile(profile));
}

export function removeLibraryProfile(
  settings: DesktopBootstrapSettings,
  id: string,
): DesktopBootstrapSettings {
  const profiles = (settings.libraryProfiles ?? []).filter((profile) => profile.id !== id);
  if (settings.activeLibraryProfileId !== id) return { ...settings, libraryProfiles: profiles };
  if (profiles.length) return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, profiles[0]);
  return {
    ...settings,
    libraryProfiles: [],
    activeLibraryProfileId: undefined,
    libraryPath: undefined,
    libraryRoots: [],
    mediaScanPaths: [],
    nfoScanPaths: [],
    sharedPackPaths: [],
  };
}

export function renameLibraryProfile(
  settings: DesktopBootstrapSettings,
  id: string,
  name: string,
): DesktopBootstrapSettings {
  const cleaned = cleanProfileName(name);
  return {
    ...settings,
    libraryProfiles: (settings.libraryProfiles ?? []).map((profile) => profile.id === id
      ? { ...profile, name: cleaned, updatedAt: new Date().toISOString() }
      : profile),
  };
}

export function activeLibraryProfile(settings: DesktopBootstrapSettings): DesktopLibraryProfile | null {
  const profiles = settings.libraryProfiles ?? [];
  return profiles.find((profile) => profile.id === settings.activeLibraryProfileId) ?? profiles[0] ?? null;
}

export function hasUnsavedLibraryPaths(
  current: DesktopBootstrapSettings,
  saved: DesktopBootstrapSettings,
): boolean {
  return JSON.stringify(libraryPathSnapshot(current)) !== JSON.stringify(libraryPathSnapshot(saved));
}

function hasConfiguredLibrarySources(settings: DesktopBootstrapSettings): boolean {
  return Boolean(
    settings.libraryPath
    || settings.libraryRoots.length
    || settings.mediaScanPaths.length
    || settings.nfoScanPaths.length
    || settings.sharedPackPaths.length,
  );
}

function sameLibraryPaths(settings: DesktopBootstrapSettings, profile: DesktopLibraryProfile): boolean {
  return JSON.stringify(libraryPathSnapshot(settings)) === JSON.stringify({
    libraryPath: profile.libraryPath ?? null,
    libraryRoots: unique(profile.libraryRoots),
    mediaScanPaths: unique(profile.mediaScanPaths),
    nfoScanPaths: unique(profile.nfoScanPaths),
    sharedPackPaths: unique(profile.sharedPackPaths),
  });
}

function libraryPathSnapshot(settings: DesktopBootstrapSettings) {
  return {
    libraryPath: settings.libraryPath ?? null,
    libraryRoots: unique(settings.libraryRoots),
    mediaScanPaths: unique(settings.mediaScanPaths),
    nfoScanPaths: unique(settings.nfoScanPaths),
    sharedPackPaths: unique(settings.sharedPackPaths),
  };
}

function normalizeProfile(profile: DesktopLibraryProfile): DesktopLibraryProfile {
  return {
    ...profile,
    name: cleanProfileName(profile.name),
    libraryPath: profile.libraryPath?.trim() || undefined,
    libraryRoots: unique(profile.libraryRoots ?? []),
    mediaScanPaths: unique(profile.mediaScanPaths ?? []),
    nfoScanPaths: unique(profile.nfoScanPaths ?? []),
    sharedPackPaths: unique(profile.sharedPackPaths ?? []),
  };
}

function cleanProfileName(value: string): string {
  const name = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return name.slice(0, 80) || "未命名资料库";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
