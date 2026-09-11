#!/usr/bin/env node

/** JavBus Genre Provider Evidence 采集器。默认预览；--write 才原子写入资源目录。 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const pages = [
  { kind: "censored", url: "https://www.javbus.com/genre", pathPrefix: "/genre/" },
  { kind: "uncensored", url: "https://www.javbus.com/uncensored/genre", pathPrefix: "/uncensored/genre/" },
];
const categoryDefinitions = {
  "主題": { id: "theme", "zh-CN": "主题", en: "Theme" }, "主题": { id: "theme", "zh-CN": "主题", en: "Theme" },
  "角色": { id: "role", "zh-CN": "角色", en: "Role" },
  "服裝": { id: "clothing", "zh-CN": "服装", en: "Clothing" }, "服装": { id: "clothing", "zh-CN": "服装", en: "Clothing" },
  "體型": { id: "body_type", "zh-CN": "体型", en: "Body type" }, "体型": { id: "body_type", "zh-CN": "体型", en: "Body type" },
  "行為": { id: "behavior", "zh-CN": "行为", en: "Behavior" }, "行为": { id: "behavior", "zh-CN": "行为", en: "Behavior" },
  "玩法": { id: "practice", "zh-CN": "玩法", en: "Practices" },
  "類別": { id: "category", "zh-CN": "类别", en: "Category" }, "类别": { id: "category", "zh-CN": "类别", en: "Category" },
  "其他": { id: "other", "zh-CN": "其他", en: "Other" },
  "場景": { id: "scene", "zh-CN": "场景", en: "Scene" }, "场景": { id: "scene", "zh-CN": "场景", en: "Scene" },
};

const inputIndex = process.argv.indexOf("--input");
const inputFile = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined;
let fetchedAt = new Date().toISOString();
const pageSnapshots = [];
const items = [];
if (inputFile) {
  const captured = JSON.parse(await readFile(path.resolve(inputFile), "utf8"));
  fetchedAt = new Date(captured.fetchedAt).toISOString();
  for (const page of pages) {
    const sourceItems = captured.items.filter((item) => item.kind === page.kind);
    const parsed = sourceItems.flatMap((item) => normalizeCapturedItem(item, page));
    if (!parsed.length) throw new Error(`${inputFile}: 缺少 ${page.kind} 来源条目。`);
    pageSnapshots.push({ kind: page.kind, url: page.url, sha256: sha256(JSON.stringify(sourceItems)), hashScope: "extracted-items", itemCount: parsed.length });
    items.push(...parsed);
  }
} else {
  for (const page of pages) {
    const html = await fetchPage(page.url);
    const parsed = auditPage(html, page);
    if (!parsed.length) throw new Error(`${page.url}: 没有解析到 .genre-box 标签，页面结构可能已经变化。`);
    pageSnapshots.push({ kind: page.kind, url: page.url, sha256: sha256(html), hashScope: "response-html", itemCount: parsed.length });
    items.push(...parsed);
  }
}

const rawSnapshot = { schemaVersion: 1, kind: "provider-genre-index-evidence", provider: "javbus", fetchedAt, itemCount: items.length, pages: pageSnapshots, items };
const categoryMap = buildCategoryMap(items, fetchedAt, pageSnapshots);

if (process.argv.includes("--write")) {
  const outputRoot = path.join(process.cwd(), "resources", "provider-evidence", "javbus");
  await mkdir(outputRoot, { recursive: true });
  await atomicWrite(path.join(outputRoot, "genre-index.raw.json"), `${JSON.stringify(rawSnapshot, null, 2)}\n`);
  await atomicWrite(path.join(outputRoot, "genre-category-map.json"), `${JSON.stringify(categoryMap, null, 2)}\n`);
  await atomicWrite(path.join(outputRoot, "genre-category-map.csv"), toCsv(categoryMap.items));
  console.log(`JavBus 来源证据已保存：${items.length} 条原始记录，${categoryMap.items.length} 个名称/分类组合，${categoryMap.conflicts.length} 个来源 ID 冲突。`);
} else {
  console.log(JSON.stringify({ rawSnapshot, categoryMap }, null, 2));
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Localogue-Provider-Audit/1.0", "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" }, signal: controller.signal });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const html = await response.text();
      if (/driver-verify|captcha|cloudflare.*challenge/iu.test(html)) throw new Error(`${url}: 站点要求浏览器验证，未保存不完整结果。`);
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    } finally { clearTimeout(timeout); }
  }
  throw new Error(`${url}: 连续 3 次读取失败`, { cause: lastError });
}

function auditPage(html, page) {
  const result = [];
  const sections = /<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<div[^>]*class=["'][^"']*genre-box[^"']*["'][^>]*>([\s\S]*?)<\/div>/giu;
  for (const section of html.matchAll(sections)) {
    const sourceCategory = cleanText(section[1]);
    const category = categoryDefinitions[sourceCategory];
    if (!category) throw new Error(`JavBus 出现未知分类：${sourceCategory}`);
    for (const link of section[2].matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
      const href = link[1].trim();
      const sourceId = extractSourceId(href, page.pathPrefix);
      const sourceName = cleanText(link[2]);
      if (!sourceId || !sourceName) continue;
      result.push({ provider: "javbus", sourceGroup: page.kind, sourceCategory, categoryId: category.id, sourceId, sourceName, url: new URL(href, page.url).href });
    }
  }
  return result;
}

function normalizeCapturedItem(item, page) {
  const sourceCategory = cleanText(String(item.category ?? ""));
  const category = categoryDefinitions[sourceCategory];
  const sourceName = cleanText(String(item.name ?? ""));
  const href = String(item.href ?? "").trim();
  const sourceId = extractSourceId(href, page.pathPrefix);
  return category && sourceName && sourceId ? [{ provider: "javbus", sourceGroup: page.kind, sourceCategory, categoryId: category.id, sourceId, sourceName, url: new URL(href, page.url).href }] : [];
}

function buildCategoryMap(values, snapshotAt, evidencePages) {
  const groups = new Map();
  for (const item of values) {
    const key = `${normalizeName(item.sourceName)}\u0000${item.categoryId}`;
    const existing = groups.get(key) ?? { sourceName: item.sourceName, categoryId: item.categoryId, category: categoryDefinitions[item.sourceCategory], occurrences: [] };
    existing.occurrences.push({ sourceGroup: item.sourceGroup, sourceCategory: item.sourceCategory, sourceId: item.sourceId, url: item.url });
    groups.set(key, existing);
  }
  const byIdentity = new Map();
  for (const item of values) {
    const key = `${item.sourceGroup}:${item.sourceId}`;
    const variants = byIdentity.get(key) ?? [];
    if (!variants.some((value) => value.sourceName === item.sourceName && value.categoryId === item.categoryId)) variants.push({ sourceName: item.sourceName, categoryId: item.categoryId, sourceCategory: item.sourceCategory, url: item.url });
    byIdentity.set(key, variants);
  }
  const conflicts = [...byIdentity.entries()].filter(([, variants]) => variants.length > 1).map(([providerIdentity, variants]) => ({ providerIdentity, variants }));
  return {
    schemaVersion: 1, kind: "provider-genre-category-map", provider: "javbus", snapshotAt,
    strategy: "exact-source-name-and-category; retain-unmatched; never-write-canonical",
    sourceItemCount: values.length, uniqueItemCount: groups.size,
    categories: [...new Map(Object.values(categoryDefinitions).map((value) => [value.id, value])).values()], pages: evidencePages, conflicts,
    items: [...groups.values()].sort((a, b) => a.categoryId.localeCompare(b.categoryId, "en") || a.sourceName.localeCompare(b.sourceName, "zh")),
  };
}

function extractSourceId(href, prefix) {
  const pathname = new URL(href, "https://www.javbus.com").pathname.replace(/\/$/u, "");
  const expected = `${prefix.replace(/\/$/u, "")}/`;
  if (!pathname.startsWith(expected)) return undefined;
  const sourceId = pathname.slice(expected.length);
  return sourceId && !sourceId.includes("/") ? sourceId : undefined;
}
function cleanText(value) { return value.replace(/<[^>]+>/gu, " ").replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&").replace(/&#39;/giu, "'").replace(/&quot;/giu, '"').replace(/\s+/gu, " ").trim(); }
function normalizeName(value) { return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN"); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function atomicWrite(file, content) { const temporary = `${file}.tmp`; await writeFile(temporary, content, "utf8"); await rename(temporary, file); }
function toCsv(values) {
  const header = ["sourceName", "categoryId", "categoryZh", "categoryEn", "sourceGroups", "sourceIds", "urls"];
  const rows = values.map((item) => [item.sourceName, item.categoryId, item.category["zh-CN"], item.category.en, [...new Set(item.occurrences.map((value) => value.sourceGroup))].join(";"), [...new Set(item.occurrences.map((value) => `${value.sourceGroup}:${value.sourceId}`))].join(";"), [...new Set(item.occurrences.map((value) => value.url))].join(";")]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
function csvCell(value) { const text = String(value ?? ""); return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
