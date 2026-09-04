import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * 管理可重置的 Desktop 开发 Fixture Library。
 *
 * 源模板永远保存在 examples/dev-library/template/，不应被 Desktop 直接写入。
 * 运行时副本固定生成到 var/dev-fixture-library/：
 *
 *   pnpm desktop:demo:seed   # 目标不存在时创建；已存在则保留现状
 *   pnpm desktop:demo:reset  # 删除目标后重新复制干净模板
 *   pnpm desktop:demo:clean  # 删除运行时副本
 *
 * 脚本不会改写 .localogue/settings.json，也不会偷偷切换用户当前 Private Library。
 */
const sourceRoot = path.join(process.cwd(), "examples", "dev-library", "template");
const targetRoot = path.join(process.cwd(), "var", "dev-fixture-library");
const companionSharedPack = path.join(process.cwd(), "examples", "shared-packs", "starter-community-pack");
const existingWorkImport = path.join(process.cwd(), "examples", "imports", "sample-existing-work.json");
const action = process.argv[2] ?? "seed";
const requiredCollections = [
  "works",
  "people",
  "organizations",
  "series",
  "genres",
  "tags",
  "assets",
  "media-files",
  "presentation-preferences",
  "media-binding-receipts",
  "asset-files",
];

if (!new Set(["seed", "reset", "clean"]).has(action)) {
  console.error(`未知 Dev Fixture 动作：${action}`);
  console.error("允许值：seed / reset / clean");
  process.exit(1);
}

if (action === "clean") {
  await rm(targetRoot, { recursive: true, force: true });
  console.log(`Localogue Dev Fixture 已清理：${targetRoot}`);
  process.exit(0);
}

if (action === "seed" && await exists(targetRoot)) {
  console.log(`Localogue Dev Fixture 已存在，未覆盖：${targetRoot}`);
  console.log("需要恢复干净测试状态时运行：pnpm desktop:demo:reset");
  printUsage();
  process.exit(0);
}

if (action === "reset") {
  await rm(targetRoot, { recursive: true, force: true });
}

await mkdir(path.dirname(targetRoot), { recursive: true });
await cp(sourceRoot, targetRoot, { recursive: true, force: false, errorOnExist: true });
for (const collection of requiredCollections) {
  await mkdir(path.join(targetRoot, collection), { recursive: true });
}

console.log(`Localogue Dev Fixture ${action === "reset" ? "已重置" : "已创建"}：${targetRoot}`);
printUsage();

function printUsage() {
  console.log("\nDesktop 使用方式：");
  console.log("1. 打开 设置 → 私人资料库 → 选择目录");
  console.log(`2. 选择：${targetRoot}`);
  console.log("3. 点击刷新资料；即可测试首选封面、首选头像、失效偏好与删除保护。");
  console.log(`4. 可选：在 资料包 中挂载 Shared Pack：${companionSharedPack}`);
  console.log("   用于验证同 ID 实体的 Private > Shared 读取优先级。");
  console.log(`5. Review 联动样例：${existingWorkImport}（LX-101，时长故意与 Canonical 不同）。\n`);
}

async function exists(value) {
  try {
    await stat(value);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
