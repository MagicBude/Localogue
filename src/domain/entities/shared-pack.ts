import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

/**
 * Localogue Shared Pack 的清单文件。
 *
 * Shared Pack 是“可分发的只读基础资料”，不是用户的私人 Library。
 * V1-09 先建立目录挂载协议；V1-10 以后再逐步加入图片 Asset 打包。
 */
export interface SharedPackManifest {
  schemaVersion: 1;
  kind: "shared-library";
  id: string;
  name: string;
  version: string;
  description?: string;
  languages?: SupportedLanguage[];
  /** SPDX 或人类可读许可证标识；未知时不要伪造。 */
  license?: string;
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResolvedSharedPack {
  configuredPath: string;
  absolutePath: string;
  libraryPath: string | null;
  valid: boolean;
  manifest: SharedPackManifest | null;
  error?: string;
}
