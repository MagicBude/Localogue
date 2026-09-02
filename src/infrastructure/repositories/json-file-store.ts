import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * JSON 文件存储的最低层工具。
 *
 * 这一层只关心“文件如何安全地读写”，不认识 Work、Person 等业务概念。
 * 这也是分层设计的一个典型例子：低层工具保持职责单一。
 */
export class JsonFileStore {
  constructor(private readonly rootDirectory: string) {}

  async readCollection<T>(directoryName: string): Promise<T[]> {
    const directory = path.join(this.rootDirectory, directoryName);

    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }
      throw error;
    }

    const jsonNames = names.filter((name) => name.endsWith(".json")).sort();

    return Promise.all(
      jsonNames.map(async (name) => {
        const raw = await readFile(path.join(directory, name), "utf8");
        return JSON.parse(raw) as T;
      }),
    );
  }

  async writeEntity<T extends { id: string }>(
    directoryName: string,
    entity: T,
  ): Promise<void> {
    const directory = path.join(this.rootDirectory, directoryName);
    await mkdir(directory, { recursive: true });

    const finalPath = path.join(directory, `${toSafeFileName(entity.id)}.json`);
    const temporaryPath = `${finalPath}.tmp`;
    const serialized = `${JSON.stringify(entity, null, 2)}\n`;

    // 先写临时文件，再 rename 覆盖正式文件。
    // rename 在同一文件系统内通常是原子的，可降低写到一半程序中断造成损坏的风险。
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, finalPath);
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
