import type { DesktopBootstrapSettings, DesktopLibraryProfile } from "./contracts";
import { normalizeContentFolders } from "./content-folders";

const PROFILE_PREFIX = "library_profile_";

/** Settings V2 中 Profile 是影片库路径配置的唯一来源。 */
export function createLibraryProfileId(): string {
  const random = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PROFILE_PREFIX}${random}`;
}

export function createEmptyLibraryProfile(id: string, name: string): DesktopLibraryProfile {
  const now = new Date().toISOString();
  return { id, name: cleanProfileName(name), contentFolders: [], sharedPackPaths: [], createdAt: now, updatedAt: now };
}

export function nextLibraryProfileName(settings: DesktopBootstrapSettings, prefix = "影片库"): string {
  const names = new Set(settings.libraryProfiles.map((profile) => profile.name.trim()));
  for (let index = 1; index < 10_000; index += 1) if (!names.has(`${prefix} ${index}`)) return `${prefix} ${index}`;
  return `${prefix} ${Date.now()}`;
}

export function isDevFixtureLibraryPath(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  return normalized.endsWith("/var/dev-fixture-library") || normalized.endsWith("/dev-fixture-library") || normalized.endsWith("/example-library");
}

export function normalizeDesktopSettings(settings: DesktopBootstrapSettings): DesktopBootstrapSettings {
  const profiles = settings.libraryProfiles.map(normalizeProfile);
  const active = profiles.find((profile) => profile.id === settings.activeLibraryProfileId) ?? profiles[0];
  return { ...settings, schemaVersion: 2, libraryProfiles: profiles, activeLibraryProfileId: active?.id };
}

export function activeLibraryProfile(settings: DesktopBootstrapSettings): DesktopLibraryProfile | null {
  return settings.libraryProfiles.find((profile) => profile.id === settings.activeLibraryProfileId) ?? settings.libraryProfiles[0] ?? null;
}

export function selectLibraryProfile(settings: DesktopBootstrapSettings, id: string): DesktopBootstrapSettings {
  return settings.libraryProfiles.some((profile) => profile.id === id) ? { ...settings, activeLibraryProfileId: id } : settings;
}

export function addLibraryProfile(settings: DesktopBootstrapSettings, profile: DesktopLibraryProfile): DesktopBootstrapSettings {
  const normalized = normalizeProfile(profile);
  return { ...settings, libraryProfiles: [...settings.libraryProfiles.filter((item) => item.id !== normalized.id), normalized], activeLibraryProfileId: normalized.id };
}

export function updateLibraryProfile(settings: DesktopBootstrapSettings, id: string, patch: Partial<Omit<DesktopLibraryProfile, "id">>): DesktopBootstrapSettings {
  return { ...settings, libraryProfiles: settings.libraryProfiles.map((profile) => profile.id === id ? normalizeProfile({ ...profile, ...patch, id, updatedAt: new Date().toISOString() }) : profile) };
}

export function removeLibraryProfile(settings: DesktopBootstrapSettings, id: string): DesktopBootstrapSettings {
  const profiles = settings.libraryProfiles.filter((profile) => profile.id !== id);
  const activeId = settings.activeLibraryProfileId === id ? profiles[0]?.id : settings.activeLibraryProfileId;
  return { ...settings, libraryProfiles: profiles, activeLibraryProfileId: activeId };
}

export function renameLibraryProfile(settings: DesktopBootstrapSettings, id: string, name: string): DesktopBootstrapSettings {
  return updateLibraryProfile(settings, id, { name: cleanProfileName(name) });
}

export function hasUnsavedLibraryPaths(current: DesktopBootstrapSettings, saved: DesktopBootstrapSettings): boolean {
  return JSON.stringify(activeLibraryProfile(current)) !== JSON.stringify(activeLibraryProfile(saved));
}

function normalizeProfile(profile: DesktopLibraryProfile): DesktopLibraryProfile {
  return { ...profile, name: cleanProfileName(profile.name), libraryPath: profile.libraryPath?.trim() || undefined, contentFolders: normalizeContentFolders(profile), sharedPackPaths: unique(profile.sharedPackPaths ?? []) };
}

function cleanProfileName(value: string): string {
  const name = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return name.slice(0, 80) || "未命名影片库";
}

function unique(values: string[]): string[] { return [...new Set(values.map((item) => item.trim()).filter(Boolean))]; }
