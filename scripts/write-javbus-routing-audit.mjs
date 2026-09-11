import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const input = path.join(root, "resources", "provider-evidence", "javbus", "genre-category-map.json");
const output = path.join(root, "resources", "provider-evidence", "javbus", "genre-routing-audit.json");
const run = spawnSync(process.execPath, [path.join(root, "scripts", "report-vocabulary-coverage.mjs"), input, "--column", "sourceName", "--json"], { cwd: root, encoding: "utf8" });
if (run.status !== 0) throw new Error(`JavBus 路由审计失败：${run.stderr || run.stdout}`);
const report = JSON.parse(run.stdout);
const document = {
  schemaVersion: 1,
  kind: "provider-classification-routing-audit",
  provider: "javbus",
  source: "genre-category-map.json",
  note: "这是对当前 Localogue 词表的离线匹配结果；unmapped 必须保留，不能自动创建 Canonical Genre。",
  ...report,
};
const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
await rename(temporary, output);
console.log(`JavBus 路由审计已保存：${report.input} 个唯一来源名称，已识别 ${report.genre + report.workType + report.sourceOnly + report.review}，未映射 ${report.unmapped}。`);
