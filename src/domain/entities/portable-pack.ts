export type PortablePackKind = "shared-library" | "personal-backup";

/**
 * `.localogue-pack` 是 V1-11 的便携包容器。
 *
 * 文件本身使用 gzip 压缩一个 JSON Envelope。这样 V1 不需要额外 ZIP 依赖，
 * 又能同时保存 UTF-8 JSON 与二进制 Asset。V2 如果需要更高效的流式归档，
 * 可以替换容器实现，而不改变 Pack Manifest / Import Plan 的业务语义。
 */
export interface PortablePackManifest {
  schemaVersion: 1;
  kind: PortablePackKind;
  id: string;
  name: string;
  version: string;
  createdAt: string;
  sourcePackId?: string;
  sourcePackVersion?: string;
  description?: string;
}

export interface PortablePackFile {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
  sha256: string;
  size: number;
}

export interface PortablePackEnvelope {
  schemaVersion: 1;
  format: "localogue-portable-pack";
  manifest: PortablePackManifest;
  files: PortablePackFile[];
}

export interface PortablePackPreview {
  manifest: PortablePackManifest;
  fileCount: number;
  totalBytes: number;
  errors: string[];
  warnings: string[];
  conflicts: string[];
  importable: boolean;
}

export interface PortablePackImportResult {
  kind: PortablePackKind;
  imported: number;
  skipped: number;
  installedPath?: string;
  sharedPackPath?: string;
  warnings: string[];
}
