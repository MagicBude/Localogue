import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const desktopRoot = path.join(root, "apps", "desktop");

// V1-13 初期版本曾让 `tsc -b` 把 vite.config.ts emit 成同目录 JS/DTS。
// ZIP 覆盖升级不会删除旧文件，而 Vite 自动配置发现可能拾取这些陈旧产物。
// 现在正式配置已经迁移到 vite.config.mts 并由命令行显式指定；这里负责清理
// 旧源文件和历史编译产物，让“覆盖升级”也能得到确定的构建输入。
const legacyPaths = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.js.map",
  "vite.config.d.ts",
  "vite.config.d.ts.map",
  "tsconfig.node.tsbuildinfo",
  "tsconfig.app.tsbuildinfo",
];

const removed = [];
for (const relativePath of legacyPaths) {
  const target = path.join(desktopRoot, relativePath);
  try {
    await rm(target, { force: true });
    removed.push(relativePath);
  } catch (error) {
    throw new Error(`无法清理 Desktop 历史构建文件 ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Localogue Desktop 历史构建文件清理完成。检查 ${legacyPaths.length} 项。`);
