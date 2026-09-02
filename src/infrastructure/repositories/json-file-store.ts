import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * JSON 文件存储的最低层工具。
 *
 * 这一层只关心“文件如何安全地读写”，不认识 Work、Person 等业务概念。
 * 这也是分层设计的一个典型例子：低层工具保持职责单一。
 */
export type JsonStoreRoots = string | readonly string[] | (() => readonly string[]);

export class JsonFileStore {
  constructor(private readonly roots: JsonStoreRoots) {}

  /**
   * 从一个或多个只读根合并同名 collection。
   *
   * 根目录顺序就是优先级：第一个根中已经出现的实体 ID 会遮蔽后续根的同 ID 实体。
   * 这正是 V1-09 的 Local Override 语义：
   *
   * private library > shared pack 1 > shared pack 2 > ...
   *
   * 注意：这里是“整实体覆盖”，不是字段级 patch merge。V1 JSON 阶段故意保持简单可解释。
   */
  async readCollection<T extends { id: string }>(directoryName: string): Promise<T[]> {
    const merged = new Map<string, T>();

    for (const rootDirectory of this.resolveRoots()) {
      const directory = path.join(rootDirectory, directoryName);
      let names: string[];
      try {
        names = await readdir(directory);
      } catch (error) {
        if (isMissingFileError(error)) continue;
        throw error;
      }

      for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
        const raw = await readFile(path.join(directory, name), "utf8");
        const entity = JSON.parse(raw) as T;
        if (!entity.id) {
          throw new Error(`${directoryName}/${name} 缺少 id，无法参与多层资料合并。`);
        }
        if (!merged.has(entity.id)) merged.set(entity.id, entity);
      }
    }

    return [...merged.values()];
  }

  async writeEntity<T extends { id: string }>(
    directoryName: string,
    entity: T,
  ): Promise<void> {
    const rootDirectory = this.resolveRoots()[0];
    if (!rootDirectory) throw new Error("JsonFileStore 没有可写根目录。");
    const directory = path.join(rootDirectory, directoryName);
    await mkdir(directory, { recursive: true });

    const finalPath = path.join(directory, `${toSafeFileName(entity.id)}.json`);
    const temporaryPath = `${finalPath}.tmp`;
    const serialized = `${JSON.stringify(entity, null, 2)}\n`;

    // 先写临时文件，再 rename 覆盖正式文件。
    // rename 在同一文件系统内通常是原子的，可降低写到一半程序中断造成损坏的风险。
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, finalPath);
  }

  async deleteEntity(directoryName: string, id: string): Promise<void> {
    const rootDirectory = this.resolveRoots()[0];
    if (!rootDirectory) throw new Error("JsonFileStore 没有可写根目录。");
    const finalPath = path.join(rootDirectory, directoryName, `${toSafeFileName(id)}.json`);
    try {
      await unlink(finalPath);
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  private resolveRoots(): string[] {
    const value = typeof this.roots === "function" ? this.roots() : this.roots;
    return typeof value === "string" ? [value] : [...value].filter(Boolean);
  }
}

export function toSafeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
