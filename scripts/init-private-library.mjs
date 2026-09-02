import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { resolvePrivateLibraryRoot } from "./lib/runtime-settings.mjs";

/**
 * 初始化私人 Canonical Library 目录结构。
 *
 * V1-09 起默认只创建空结构，避免把虚构 Demo 混进真实资料。
 * 只有显式传入 --demo 才复制教学数据：
 *
 *   pnpm library:init:demo
 */
const sourceRoot = path.join(process.cwd(), "data", "demo-library");
const targetRoot = resolvePrivateLibraryRoot() ?? path.join(process.cwd(), "data", "library");
const copyDemo = process.argv.includes("--demo");
const canonicalCollections = [
  "works",
  "people",
  "organizations",
  "series",
  "genres",
  "tags",
  "assets",
  "media-files",
  "presentation-preferences",
];

await mkdir(targetRoot, { recursive: true });
await mkdir(path.join(targetRoot, "asset-files"), { recursive: true });
for (const collection of canonicalCollections) {
  await mkdir(path.join(targetRoot, collection), { recursive: true });
}

let copied = 0;
let skipped = 0;

if (copyDemo) {
  for (const collection of canonicalCollections) {
    const source = path.join(sourceRoot, collection);
    const target = path.join(targetRoot, collection);
    let names = [];
    try {
      names = (await readdir(source)).filter((item) => item.endsWith(".json"));
    } catch {
      continue;
    }

    const existing = new Set(await readdir(target));
    for (const name of names) {
      if (existing.has(name)) {
        skipped += 1;
        continue;
      }
      await cp(path.join(source, name), path.join(target, name));
      copied += 1;
    }
  }
}

console.log(`Localogue 私人资料库目录：${targetRoot}`);
if (copyDemo) {
  console.log(`教学 Demo 初始化完成：复制 ${copied} 个文件，跳过 ${skipped} 个已存在文件。`);
} else {
  console.log("空资料库结构初始化完成；没有复制任何 Demo 数据。");
}
console.log("\n从 V1-09 起可在 /settings 页面设置 Library 路径；若使用 LOCALOGUE_LIBRARY_PATH 环境变量，则环境变量优先。\n");
