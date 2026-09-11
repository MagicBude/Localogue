import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * 生成 JavBus 分类人工审核表。
 *
 * Provider Evidence 与审核结论故意分开：前者可以由采集器重建，后者是人工劳动。
 * 因此脚本重跑时会按来源名称保留“审核决定 / 目标 ID / 审核备注”三列，避免刷新
 * 来源快照时覆盖已经完成的判断。
 */
const root = process.cwd();
const evidenceRoot = path.join(root, "resources", "provider-evidence", "javbus");
const routing = JSON.parse(await readFile(path.join(evidenceRoot, "genre-routing-audit.json"), "utf8"));
const categoryMap = JSON.parse(await readFile(path.join(evidenceRoot, "genre-category-map.json"), "utf8"));
const providerAliases = JSON.parse(await readFile(path.join(root, "resources", "vocabularies", "genre-source-aliases.json"), "utf8"));
const output = path.join(evidenceRoot, "genre-manual-review.csv");

const preserved = await readPreservedDecisions(output);
const itemsByName = new Map();
for (const item of categoryMap.items) {
  const key = normalize(item.sourceName);
  const aggregate = itemsByName.get(key) ?? { sourceName: item.sourceName, categories: new Set(), groups: new Set(), ids: new Set(), urls: new Set() };
  aggregate.categories.add(`${item.category["zh-CN"]} (${item.categoryId})`);
  for (const occurrence of item.occurrences) {
    aggregate.groups.add(occurrence.sourceGroup);
    aggregate.ids.add(`${occurrence.sourceGroup}:${occurrence.sourceId}`);
    aggregate.urls.add(occurrence.url);
  }
  itemsByName.set(key, aggregate);
}

const reviewCandidates = new Map((routing.details.review ?? []).map((item) => [normalize(item.term), item.candidates]));
const ambiguousCandidates = buildProviderAliasCollisions(providerAliases.items ?? []);
const pending = [
  ...(routing.details.review ?? []).map((item) => ({ status: "需要人工审核", term: item.term })),
  ...(routing.details.ambiguous ?? []).map((term) => ({ status: "运行时歧义", term })),
  ...(routing.details.unmapped ?? []).map((term) => ({ status: "尚未映射", term })),
];

const headers = ["状态", "来源名称", "页面分类", "来源分区", "来源ID", "候选目标", "审核决定", "目标ID", "审核备注", "来源URL"];
const rows = pending.map(({ status, term }) => {
  const key = normalize(term);
  const source = itemsByName.get(key);
  if (!source) throw new Error(`审核项在来源分类映射中不存在：${term}`);
  const old = preserved.get(key) ?? {};
  const candidates = reviewCandidates.get(key) ?? ambiguousCandidates.get(key) ?? [];
  return [
    status,
    term,
    [...source.categories].join(" | "),
    [...source.groups].join(" | "),
    [...source.ids].join(" | "),
    candidates.join(" | "),
    old.decision ?? "",
    old.targets ?? "",
    old.note ?? "",
    [...source.urls].join(" | "),
  ];
});

const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}\r\n`;
const temporary = `${output}.tmp`;
await writeFile(temporary, csv, "utf8");
await rename(temporary, output);
console.log(`JavBus 人工审核表已保存：${rows.length} 项（审核 ${routing.review}、歧义 ${routing.ambiguous}、未映射 ${routing.unmapped}）。`);

function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildProviderAliasCollisions(items) {
  const targets = new Map();
  for (const item of items) {
    for (const name of [item.ja, item["zh-CN"], item.en]) {
      const key = normalize(name);
      if (!key) continue;
      const values = targets.get(key) ?? new Set();
      values.add(`genre:${item.canonicalId}`);
      targets.set(key, values);
    }
  }
  return new Map([...targets].filter(([, values]) => values.size > 1).map(([key, values]) => [key, [...values].sort()]));
}

async function readPreservedDecisions(file) {
  try {
    const rows = parseCsv((await readFile(file, "utf8")).replace(/^\uFEFF/u, ""));
    const header = rows.shift() ?? [];
    const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
    return new Map(rows.filter((row) => row[indexes["来源名称"]]).map((row) => [normalize(row[indexes["来源名称"]]), {
      decision: row[indexes["审核决定"]] ?? "",
      targets: row[indexes["目标ID"]] ?? "",
      note: row[indexes["审核备注"]] ?? "",
    }]));
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
