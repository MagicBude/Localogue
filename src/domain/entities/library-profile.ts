/**
 * Library Profile：网页端与桌面端共用的多资料库资料源预设。
 *
 * 这是 Localogue V1-24A 在桌面端引入、现下放到网页端的“资料库工作区”概念。
 * 每个 Profile 独立保存一组资料源配置：
 *
 * - 私人 Canonical Library（可写）；
 * - 统一资料源根目录（Unified Roots）；
 * - 高级媒体 / NFO 扫描目录；
 * - 只读共享资料包（Shared Packs）。
 *
 * Profile 本身不带任何内容分类含义。除内置开发 / 示例资料库使用有意义的名称外，
 * 普通新建资料库只使用“资料库 1 / 资料库 2 …”这类中性名称，由用户自行重命名。
 * ffprobe / Web URL 等真正的应用级设置保持全局，不随资料库切换。
 *
 * 本模块是纯函数，不依赖 Node 文件系统或 Tauri Native，因此网页端与桌面端
 * 可以共用同一套 Profile 状态机逻辑（桌面端在自身 contracts 中复用相同形状）。
 */

export interface LibraryProfile {
  id: string;
  name: string;
  description?: string;
  libraryPath?: string;
  libraryRoots: string[];
  mediaScanPaths: string[];
  nfoScanPaths: string[];
  sharedPackPaths: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 同时持有“平面资料源字段”和“Profile 列表 + 当前激活 ID”的设置形状。
 * 网页端 InstanceSettings 与桌面端 BootstrapSettings 都满足这个结构，
 * 因此下面的纯函数可以跨端复用。
 */
export interface ProfileSettings {
  libraryPath?: string;
  libraryRoots?: string[];
  mediaScanPaths?: string[];
  nfoScanPaths?: string[];
  sharedPackPaths: string[];
  libraryProfiles?: LibraryProfile[];
  activeLibraryProfileId?: string;
}

const PROFILE_PREFIX = "library_profile_";
const LEGACY_PROFILE_ID = "library_profile_legacy_default";

export function createLibraryProfileId(): string {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PROFILE_PREFIX}${random}`;
}

/** 用当前路径快照创建 Profile，主要用于旧单实例设置迁移与示例库接入。 */
export function createLibraryProfile(
  settings: ProfileSettings,
  id: string,
  name: string,
): LibraryProfile {
  const now = new Date().toISOString();
  return snapshotLibraryProfile(settings, {
    id,
    name: cleanProfileName(name),
    createdAt: now,
    updatedAt: now,
  });
}

/** 新建一个完全不指向任何路径的资料库。 */
export function createEmptyLibraryProfile(id: string, name: string): LibraryProfile {
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
  settings: ProfileSettings,
  prefix = "资料库",
): string {
  const names = new Set((settings.libraryProfiles ?? []).map((profile) => profile.name.trim()));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${prefix} ${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${prefix} ${Date.now()}`;
}

/**
 * 把 V1-24 之前的单组路径设置平滑升级成一个 Profile。
 * 这一步只发生在内存中；真正写回仍通过用户后续保存/切换动作完成。
 */
export function ensureLibraryProfiles<T extends ProfileSettings>(settings: T): T {
  const profiles = (settings.libraryProfiles ?? []).map(normalizeProfile);

  if (!profiles.length) {
    if (!hasConfiguredLibrarySources(settings)) {
      return { ...settings, libraryProfiles: [], activeLibraryProfileId: undefined } as T;
    }
    const isExample = isLocalExampleLibraryPath(settings.libraryPath);
    const profile = createLibraryProfile(
      settings,
      LEGACY_PROFILE_ID,
      isExample ? "示例库" : "资料库 1",
    );
    return applyLibraryProfile({ ...settings, libraryProfiles: [profile] }, profile) as T;
  }

  const currentActive = profiles.find((profile) => profile.id === settings.activeLibraryProfileId);
  if (currentActive) {
    return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, currentActive) as T;
  }

  const matching = profiles.find((profile) => sameLibraryPaths(settings, profile));
  if (matching) {
    return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, matching) as T;
  }

  // 一旦已经存在 Profile，列表就是资料库配置的事实源。active ID 失效时只允许
  // 回退到现有 Profile，绝不能把平面兼容字段再次“迁移”为一个新 Profile。
  return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, profiles[0]) as T;
}

export function snapshotLibraryProfile(
  settings: ProfileSettings,
  profile: Pick<LibraryProfile, "id" | "name"> & Partial<LibraryProfile>,
): LibraryProfile {
  const now = new Date().toISOString();
  return {
    id: profile.id,
    name: cleanProfileName(profile.name),
    description: profile.description?.trim() || undefined,
    libraryPath: settings.libraryPath,
    libraryRoots: unique(settings.libraryRoots ?? []),
    mediaScanPaths: unique(settings.mediaScanPaths ?? []),
    nfoScanPaths: unique(settings.nfoScanPaths ?? []),
    sharedPackPaths: unique(settings.sharedPackPaths ?? []),
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  };
}

export function applyLibraryProfile<T extends ProfileSettings>(
  settings: T,
  profile: LibraryProfile,
): T {
  return {
    ...settings,
    activeLibraryProfileId: profile.id,
    libraryPath: profile.libraryPath,
    libraryRoots: [...profile.libraryRoots],
    mediaScanPaths: [...profile.mediaScanPaths],
    nfoScanPaths: [...profile.nfoScanPaths],
    sharedPackPaths: [...profile.sharedPackPaths],
  } as T;
}

/** 保存设置时，把当前平面路径状态写回当前 Profile。 */
export function syncActiveLibraryProfile<T extends ProfileSettings>(settings: T): T {
  const profiles = (settings.libraryProfiles ?? []).map(normalizeProfile);
  if (!profiles.length) {
    return { ...settings, libraryProfiles: [], activeLibraryProfileId: undefined } as T;
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
  } as T;
}

export function addLibraryProfile<T extends ProfileSettings>(
  settings: T,
  profile: LibraryProfile,
): T {
  const profiles = [...(settings.libraryProfiles ?? []).filter((item) => item.id !== profile.id), normalizeProfile(profile)];
  return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, normalizeProfile(profile)) as T;
}

export function removeLibraryProfile<T extends ProfileSettings>(
  settings: T,
  id: string,
): T {
  const profiles = (settings.libraryProfiles ?? []).filter((profile) => profile.id !== id);
  if (settings.activeLibraryProfileId !== id) {
    return { ...settings, libraryProfiles: profiles } as T;
  }
  if (profiles.length) {
    return applyLibraryProfile({ ...settings, libraryProfiles: profiles }, profiles[0]) as T;
  }
  return {
    ...settings,
    libraryProfiles: [],
    activeLibraryProfileId: undefined,
    libraryPath: undefined,
    libraryRoots: [],
    mediaScanPaths: [],
    nfoScanPaths: [],
    sharedPackPaths: [],
  } as T;
}

export function renameLibraryProfile<T extends ProfileSettings>(
  settings: T,
  id: string,
  name: string,
): T {
  const cleaned = cleanProfileName(name);
  return {
    ...settings,
    libraryProfiles: (settings.libraryProfiles ?? []).map((profile) => profile.id === id
      ? { ...profile, name: cleaned, updatedAt: new Date().toISOString() }
      : profile),
  } as T;
}

export function activeLibraryProfile(settings: ProfileSettings): LibraryProfile | null {
  const profiles = settings.libraryProfiles ?? [];
  return profiles.find((profile) => profile.id === settings.activeLibraryProfileId) ?? profiles[0] ?? null;
}

/** 解析出当前激活 Profile（或回退平面字段）提供的资料源路径集合。 */
export function resolveActiveSources(settings: ProfileSettings): {
  libraryPath?: string;
  libraryRoots: string[];
  mediaScanPaths: string[];
  nfoScanPaths: string[];
  sharedPackPaths: string[];
} {
  const profile = activeLibraryProfile(settings);
  return {
    libraryPath: profile?.libraryPath ?? settings.libraryPath,
    libraryRoots: profile?.libraryRoots ?? settings.libraryRoots ?? [],
    mediaScanPaths: profile?.mediaScanPaths ?? settings.mediaScanPaths ?? [],
    nfoScanPaths: profile?.nfoScanPaths ?? settings.nfoScanPaths ?? [],
    sharedPackPaths: profile?.sharedPackPaths ?? settings.sharedPackPaths ?? [],
  };
}

function hasConfiguredLibrarySources(settings: ProfileSettings): boolean {
  return Boolean(
    settings.libraryPath
    || settings.libraryRoots?.length
    || settings.mediaScanPaths?.length
    || settings.nfoScanPaths?.length
    || settings.sharedPackPaths?.length,
  );
}

function sameLibraryPaths(settings: ProfileSettings, profile: LibraryProfile): boolean {
  return JSON.stringify(libraryPathSnapshot(settings)) === JSON.stringify({
    libraryPath: profile.libraryPath ?? null,
    libraryRoots: unique(profile.libraryRoots),
    mediaScanPaths: unique(profile.mediaScanPaths),
    nfoScanPaths: unique(profile.nfoScanPaths),
    sharedPackPaths: unique(profile.sharedPackPaths),
  });
}

function libraryPathSnapshot(settings: ProfileSettings) {
  return {
    libraryPath: settings.libraryPath ?? null,
    libraryRoots: unique(settings.libraryRoots ?? []),
    mediaScanPaths: unique(settings.mediaScanPaths ?? []),
    nfoScanPaths: unique(settings.nfoScanPaths ?? []),
    sharedPackPaths: unique(settings.sharedPackPaths ?? []),
  };
}

function isLocalExampleLibraryPath(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  return normalized.endsWith("/data/demo-library")
    || normalized.endsWith("/demo-library")
    || normalized.endsWith("/data/library")
    || normalized.endsWith("/library");
}

function normalizeProfile(profile: LibraryProfile): LibraryProfile {
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
