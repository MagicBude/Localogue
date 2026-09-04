import { copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
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
 *   pnpm desktop:demo:orphan # 在运行副本制造 1 个未被 Asset JSON 引用的图片，用于测试孤儿清理
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

if (!new Set(["seed", "reset", "clean", "orphan"]).has(action)) {
  console.error(`未知 Dev Fixture 动作：${action}`);
  console.error("允许值：seed / reset / clean / orphan");
  process.exit(1);
}

if (action === "clean") {
  await rm(targetRoot, { recursive: true, force: true });
  console.log(`Localogue Dev Fixture 已清理：${targetRoot}`);
  process.exit(0);
}

if (action === "orphan") {
  if (!await exists(targetRoot)) {
    console.error("Dev Fixture 运行副本不存在。请先运行：pnpm desktop:demo:reset");
    process.exit(1);
  }
  const source = path.join(targetRoot, "asset-files", "posters", "demo-001-poster.jpg");
  const destination = path.join(targetRoot, "asset-files", "orphan-fixture-test.jpg");
  if (!await exists(source)) {
    console.error(`无法找到 Fixture 源图片：${source}`);
    process.exit(1);
  }
  await copyFile(source, destination);
  console.log(`已制造 1 个孤儿 Asset 文件：${destination}`);
  console.log("它没有对应 Asset JSON。可在 Desktop → 媒体 → 资源文件健康中检查并清理。\n");
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
  console.log("1. 这个脚本只服务开发者重置仓库内 Fixture；产品里的“+ 添加示例库”会自行初始化 App Local Data 副本。");
  console.log(`2. 如需手工测试仓库副本，Private Library 可选择：${targetRoot}`);
  console.log("3. 保存后左侧栏会显示对应 Profile 并可快速切换。");
  console.log("4. 点击刷新资料；即可使用 11 部作品 / 8 位人物 / 43 张生成式图片测试筛选、关系、首选图片与删除保护。");
  console.log(`5. 产品内置示例库也会尝试挂载同一套配套 Shared Pack：${companionSharedPack}`);
  console.log("   用于验证同 ID 实体的 Private > Shared 读取优先级。");
  console.log(`6. Review 联动样例：${existingWorkImport}（LX-101，时长故意与 Canonical 不同）。\n`);
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
