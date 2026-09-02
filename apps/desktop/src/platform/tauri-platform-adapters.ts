import type {
  FileDialogPort,
  FileHashPort,
  FileOpenerPort,
  FileSystemPort,
  MediaProbePort,
  MediaProbeResult,
  PlatformCapabilities,
  PlatformFileEntry,
  PlatformFileStat,
  WalkFilesOptions,
} from "../../../../src/application/platform/platform-ports";

import { desktopBridge } from "../tauri-bridge";

/**
 * V1-14 已补齐 FileSystem / FileHash，Desktop 与 Web 因此可以复用同一个
 * scanMediaLibrary Application Core；平台差异只停留在这些 Adapter 内。
 */
export class TauriFileDialogAdapter implements FileDialogPort {
  readonly supported = true;

  pickDirectory(): Promise<string | null> {
    return desktopBridge.pickDirectory();
  }

  pickFile(): Promise<string | null> {
    return desktopBridge.pickMediaFile();
  }
}

export class TauriFileOpenerAdapter implements FileOpenerPort {
  readonly supported = true;

  openPath(filePath: string): Promise<void> {
    return desktopBridge.openPath(filePath);
  }

  revealInFolder(filePath: string): Promise<void> {
    return desktopBridge.revealInFolder(filePath);
  }
}

export class TauriMediaProbeAdapter implements MediaProbePort {
  async probe(executable: string, filePath: string): Promise<MediaProbeResult> {
    return desktopBridge.probeMedia(executable, filePath);
  }

  isExecutableMissing(error: unknown): boolean {
    return String(error).toLowerCase().includes("ffprobe") && (
      String(error).toLowerCase().includes("not found") ||
      String(error).toLowerCase().includes("cannot find") ||
      String(error).includes("找不到") ||
      String(error).includes("无法启动")
    );
  }
}

export class TauriFileSystemAdapter implements FileSystemPort {
  resolvePath(input: string): string { return input; }
  basename(filePath: string, extensionToStrip?: string): string {
    const name = filePath.replaceAll("\\", "/").split("/").pop() ?? "";
    return extensionToStrip && name.toLowerCase().endsWith(extensionToStrip.toLowerCase()) ? name.slice(0, -extensionToStrip.length) : name;
  }
  dirname(filePath: string): string { return filePath.replaceAll("\\", "/").replace(/\/[^/]*$/, "") || "/"; }
  extname(filePath: string): string { const name = this.basename(filePath); const index = name.lastIndexOf("."); return index > 0 ? name.slice(index).toLowerCase() : ""; }
  normalizePathForIdentity(filePath: string): string {
    const normalized = filePath.replace(/[\\/]+$/, "");
    return /Windows/i.test(navigator.userAgent) ? normalized.toLocaleLowerCase() : normalized;
  }
  samePath(a: string, b: string): boolean { return this.normalizePathForIdentity(a) === this.normalizePathForIdentity(b); }
  isInside(root: string, filePath: string): boolean { return this.normalizePathForIdentity(filePath).startsWith(`${this.normalizePathForIdentity(root)}/`); }
  async stat(filePath: string, signal?: AbortSignal): Promise<PlatformFileStat> {
    throwIfAborted(signal);
    const value = await desktopBridge.statPath(filePath);
    return { path: filePath, ...value, modifiedAt: new Date(Number(value.modifiedAt)).toISOString() };
  }
  async exists(filePath: string, signal?: AbortSignal): Promise<boolean> { throwIfAborted(signal); return desktopBridge.pathExists(filePath); }
  async walkFiles(root: string, options: WalkFilesOptions = {}): Promise<PlatformFileEntry[]> {
    throwIfAborted(options.signal);
    const entries = await desktopBridge.walkFiles({ root, extensions: options.extensions, includeHidden: options.includeHidden, maxFiles: options.maxFiles });
    throwIfAborted(options.signal);
    return entries.map((entry) => ({ ...entry, modifiedAt: new Date(Number(entry.modifiedAt)).toISOString() }));
  }
}

export class TauriFileHashAdapter implements FileHashPort {
  // 与 Node Adapter 保持真正 SHA-256 一致，避免同一路径经 Web / Desktop 扫描生成两个 ID。
  sha256Text(value: string): string { return sha256Text(value); }
  async sha256File(filePath: string, signal?: AbortSignal): Promise<string> { throwIfAborted(signal); const hash = await desktopBridge.sha256File(filePath); throwIfAborted(signal); return hash; }
}

function sha256Text(value: string): string {
  const bytes = [...new TextEncoder().encode(value)];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) bytes.push(shift >= 32 ? 0 : Math.floor(bitLength / 2 ** shift) & 0xff);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i += 1) w[i] = ((bytes[offset+i*4] << 24) | (bytes[offset+i*4+1] << 16) | (bytes[offset+i*4+2] << 8) | bytes[offset+i*4+3]) | 0;
    for (let i = 16; i < 64; i += 1) { const s0 = rotate(w[i-15],7)^rotate(w[i-15],18)^(w[i-15]>>>3); const s1 = rotate(w[i-2],17)^rotate(w[i-2],19)^(w[i-2]>>>10); w[i]=(w[i-16]+s0+w[i-7]+s1)|0; }
    let [a,b,c,d,e,f,g,hh]=h;
    for (let i=0;i<64;i+=1) { const s1=rotate(e,6)^rotate(e,11)^rotate(e,25); const ch=(e&f)^(~e&g); const t1=(hh+s1+ch+k[i]+w[i])|0; const s0=rotate(a,2)^rotate(a,13)^rotate(a,22); const maj=(a&b)^(a&c)^(b&c); const t2=(s0+maj)|0; hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
    h[0]=(h[0]+a)|0;h[1]=(h[1]+b)|0;h[2]=(h[2]+c)|0;h[3]=(h[3]+d)|0;h[4]=(h[4]+e)|0;h[5]=(h[5]+f)|0;h[6]=(h[6]+g)|0;h[7]=(h[7]+hh)|0;
  }
  return h.map((item)=>(item>>>0).toString(16).padStart(8,"0")).join("");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("媒体扫描已取消。", "AbortError");
}

export const tauriDesktopCapabilities: PlatformCapabilities = {
  runtime: "tauri",
  nativeFolderPicker: true,
  nativeFilePicker: true,
  openPath: true,
  revealInFolder: true,
  backgroundMediaScan: true,
  cancellableMediaScan: true,
};
