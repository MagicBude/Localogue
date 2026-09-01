import path from "node:path";

/**
 * Canonical Library 路径策略集中在一个文件中，避免“读路径”和“写路径”各写一套规则。
 *
 * 默认 Demo Library 是只读教学资料。真正写库必须显式配置 LOCALOGUE_LIBRARY_PATH。
 */
export function getConfiguredPrivateLibraryPath(): string | null {
  const configured = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  if (!configured) return null;

  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function getReadableLibraryPath(): string {
  return (
    getConfiguredPrivateLibraryPath() ??
    path.join(process.cwd(), "data", "demo-library")
  );
}

export function isPrivateLibraryConfigured(): boolean {
  return getConfiguredPrivateLibraryPath() !== null;
}
