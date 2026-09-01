import { access, cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * 为 V1 JSON-first 阶段初始化一个可写的私人 Canonical Library。
 *
 * 默认把公开 Demo Canonical 数据复制到 data/library，方便安全练习“已有作品更新”。
 * Evidence / review-commits 等私人运行数据不会被覆盖。
 */
const sourceRoot = path.join(process.cwd(), "data", "demo-library");
const targetRoot = path.join(process.cwd(), "data", "library");
const canonicalCollections = [
  "works",
  "people",
  "organizations",
  "series",
  "genres",
  "tags",
  "assets",
  "media-files",
];

await mkdir(targetRoot, { recursive: true });
let copied = 0;
let skipped = 0;

for (const collection of canonicalCollections) {
  const source = path.join(sourceRoot, collection);
  const target = path.join(targetRoot, collection);

  if (!(await exists(source))) continue;
  await mkdir(target, { recursive: true });

  for (const name of (await readdir(source)).filter((item) => item.endsWith(".json"))) {
    const destination = path.join(target, name);
    if (await exists(destination)) {
      skipped += 1;
      continue;
    }
    await cp(path.join(source, name), destination);
    copied += 1;
  }
}

console.log(`Localogue 私人资料库初始化完成：复制 ${copied} 个文件，跳过 ${skipped} 个已存在文件。`);
console.log("\n接下来创建 .env.local，并写入：\n");
console.log("LOCALOGUE_LIBRARY_PATH=./data/library");
console.log("\n然后重新启动 pnpm dev。这样页面和 Review/Commit 都会使用私人资料库。\n");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
