import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  FileDialogPort,
  FileHashPort,
  FileOpenerPort,
  FileSystemPort,
  MediaProbePort,
  MediaProbeResult,
  PlatformFileEntry,
  PlatformFileStat,
  WalkFilesOptions,
} from "@/application/platform/platform-ports";

export class NodeFileSystemAdapter implements FileSystemPort {
  constructor(private readonly baseDirectory: string = process.cwd()) {}

  resolvePath(input: string): string {
    return path.resolve(/* turbopackIgnore: true */ this.baseDirectory, input);
  }

  basename(filePath: string, extensionToStrip?: string): string {
    return path.basename(filePath, extensionToStrip);
  }

  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  extname(filePath: string): string {
    return path.extname(filePath);
  }

  normalizePathForIdentity(filePath: string): string {
    const resolved = path.resolve(/* turbopackIgnore: true */ filePath);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  }

  samePath(a: string, b: string): boolean {
    return this.normalizePathForIdentity(a) === this.normalizePathForIdentity(b);
  }

  isInside(root: string, filePath: string): boolean {
    const relative = path.relative(
      path.resolve(/* turbopackIgnore: true */ root),
      path.resolve(/* turbopackIgnore: true */ filePath),
    );
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }

  async stat(filePath: string, signal?: AbortSignal): Promise<PlatformFileStat> {
    throwIfAborted(signal);
    const info = await stat(filePath);
    throwIfAborted(signal);
    return {
      path: filePath,
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
    };
  }

  async exists(filePath: string, signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal);
    try {
      await access(filePath);
      throwIfAborted(signal);
      return true;
    } catch (error) {
      if (isAbortError(error)) throw error;
      return false;
    }
  }

  async walkFiles(root: string, options: WalkFilesOptions = {}): Promise<PlatformFileEntry[]> {
    const extensions = options.extensions?.length
      ? new Set(options.extensions.map((item) => item.toLowerCase()))
      : null;
    const output: PlatformFileEntry[] = [];
    const maxFiles = options.maxFiles ?? Number.POSITIVE_INFINITY;

    const visit = async (directory: string): Promise<void> => {
      throwIfAborted(options.signal);
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        throwIfAborted(options.signal);
        if (!options.includeHidden && entry.name.startsWith(".")) continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          await visit(fullPath);
        } else if (entry.isFile()) {
          const extension = path.extname(entry.name).toLowerCase();
          if (extensions && !extensions.has(extension)) continue;
          const info = await stat(fullPath);
          output.push({
            path: fullPath,
            name: entry.name,
            extension,
            size: info.size,
            modifiedAt: info.mtime.toISOString(),
          });
          if (output.length >= maxFiles) return;
        }
        if (output.length >= maxFiles) return;
      }
    };

    await visit(root);
    return output;
  }
}

export class NodeMediaProbeAdapter implements MediaProbePort {
  probe(executable: string, filePath: string, signal?: AbortSignal): Promise<MediaProbeResult> {
    throwIfAborted(signal);
    return new Promise<MediaProbeResult>((resolve, reject) => {
      execFile(executable, [
        "-v", "error",
        "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,width,height",
        "-of", "json",
        filePath,
      ], {
        timeout: 20_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        signal,
      }, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as {
            format?: { format_name?: string; duration?: string };
            streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
          };
          const video = parsed.streams?.find((item) => item.codec_type === "video");
          const audio = parsed.streams?.find((item) => item.codec_type === "audio");
          const duration = parsed.format?.duration ? Number(parsed.format.duration) : undefined;
          resolve({
            ...(Number.isFinite(duration) ? { durationSeconds: duration } : {}),
            ...(video?.width ? { width: video.width } : {}),
            ...(video?.height ? { height: video.height } : {}),
            ...(video?.codec_name ? { videoCodec: video.codec_name } : {}),
            ...(audio?.codec_name ? { audioCodec: audio.codec_name } : {}),
            ...(parsed.format?.format_name ? { container: parsed.format.format_name } : {}),
          });
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  isExecutableMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}

export class NodeFileHashAdapter implements FileHashPort {
  sha256Text(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  async sha256File(filePath: string, signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal);
    const hash = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      const abort = () => {
        const error = createAbortError();
        stream.destroy(error);
      };
      signal?.addEventListener("abort", abort, { once: true });
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", resolve);
      stream.on("close", () => signal?.removeEventListener("abort", abort));
    });
    throwIfAborted(signal);
    return hash.digest("hex");
  }
}

/**
 * 浏览器版目前只能让用户输入服务器可访问路径，不能弹出长期可用的原生目录选择器。
 * V1-13 Tauri Adapter 会替换这个明确的 unsupported implementation。
 */
export class UnsupportedWebFileDialogAdapter implements FileDialogPort {
  readonly supported = false;
  async pickDirectory(): Promise<string | null> {
    throw new Error("当前 Web Runtime 不支持原生目录选择器；请在设置页输入路径。V1-13 Tauri Desktop 会提供该能力。");
  }
  async pickFile(): Promise<string | null> {
    throw new Error("当前 Web Runtime 不支持原生文件选择器。V1-13 Tauri Desktop 会提供该能力。");
  }
}

export class UnsupportedWebFileOpenerAdapter implements FileOpenerPort {
  readonly supported = false;
  async openPath(): Promise<void> {
    throw new Error("当前 Web Runtime 不允许服务端直接打开用户桌面文件。V1-13 Tauri Desktop 会提供该能力。");
  }
  async revealInFolder(): Promise<void> {
    throw new Error("当前 Web Runtime 不允许服务端直接打开资源管理器。V1-13 Tauri Desktop 会提供该能力。");
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function createAbortError(): Error {
  const error = new Error("操作已取消。");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
