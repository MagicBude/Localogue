import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Converter } from "opencc-js";

/**
 * 把“繁体转简体后仍唯一精确命中”的 JavBus 来源词固化为受控别名。
 *
 * OpenCC 只负责字符规范化，不参与语义猜测。转换后没有命中或命中冲突的词继续留在
 * 审核队列；脚本默认仅预览，只有显式 --write 才更新 JSON / CSV。
 */
const root = process.cwd();
const vocabularyRoot = path.join(root, "resources", "vocabularies");
const evidenceRoot = path.join(root, "resources", "provider-evidence", "javbus");
const shouldWrite = process.argv.includes("--write");
const toSimplified = Converter({ from: "hk", to: "cn" });

const genres = await load("genres.json");
const workTypes = await load("work-types.json");
const sourceOnly = await load("source-only-classifications.json");
const aliases = await load("classification-term-aliases.json");
const routing = JSON.parse(await readFile(path.join(evidenceRoot, "genre-routing-audit.json"), "utf8"));

const automatic = new Map();
const conflicts = new Set();
for (const item of genres.items) registerMany([item.id, item.ja, item["zh-CN"], item.en], `genre:${item.id}`);
for (const item of workTypes.items) registerMany([item.id, item.ja, item["zh-CN"], item.en, ...(item.aliases ?? [])], `workType:${item.id}`);
for (const item of sourceOnly.items) registerMany([item.id, item.ja, item["zh-CN"], item.en, ...(item.aliases ?? [])], `sourceOnly:${item.id}`);
for (const item of aliases.items) if (item.status === "approved" && item.targets?.length === 1) register(item.term, item.targets[0]);

const existing = new Set(aliases.items.map((item) => norm(item.term)));
const additions = [];
for (const term of routing.details.unmapped ?? []) {
  const simplified = toSimplified(term);
  const key = norm(simplified);
  if (simplified === term || conflicts.has(key) || existing.has(norm(term))) continue;
  const target = automatic.get(key);
  if (!target) continue;
  additions.push({
    term,
    status: "approved",
    targets: [target],
    candidateTargets: [],
    sources: ["javbus"],
    note: `JavBus 来源词经 OpenCC 香港繁体转简体为“${simplified}”，并唯一精确命中 ${target}；不进行模糊语义推断。`,
  });
}

console.log(`可保守固化 ${additions.length} 个繁简精确别名。`);
for (const item of additions) console.log(`- ${item.term} -> ${item.targets[0]}`);
if (!shouldWrite || additions.length === 0) process.exit(0);

aliases.items.push(...additions);
// 保持既有人工治理顺序，只在末尾追加新结论。重新排序会让 Git 把大量旧行显示成
// “删除后新增”，虽然数据没有丢失，却会严重干扰代码审查和用户判断。
await atomicWrite(path.join(vocabularyRoot, "classification-term-aliases.json"), `${JSON.stringify(aliases, null, 2)}\n`);
await atomicWrite(path.join(vocabularyRoot, "classification-term-aliases.csv"), toCsv(aliases.items));
console.log(`已写入 ${additions.length} 个 JavBus 精确别名；其余条目继续等待语义分流。`);

async function load(name) {
  return JSON.parse(await readFile(path.join(vocabularyRoot, name), "utf8"));
}

function registerMany(values, target) {
  for (const value of values) register(value, target);
}

function register(value, target) {
  const key = norm(value);
  if (!key || conflicts.has(key)) return;
  const current = automatic.get(key);
  if (current && current !== target) { automatic.delete(key); conflicts.add(key); }
  else automatic.set(key, target);
}

function norm(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/gu, " ");
}

function toCsv(items) {
  const rows = [["term", "status", "targets", "candidateTargets", "sources", "note"]];
  for (const item of items) rows.push([
    item.term,
    item.status,
    (item.targets ?? []).join("|"),
    (item.candidateTargets ?? []).join("|"),
    (item.sources ?? []).join("|"),
    item.note ?? "",
  ]);
  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function atomicWrite(file, content) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, file);
}
