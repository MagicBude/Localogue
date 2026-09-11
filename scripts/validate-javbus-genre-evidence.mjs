import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "resources", "provider-evidence", "javbus");
const raw = JSON.parse(readFileSync(path.join(root, "genre-index.raw.json"), "utf8"));
const map = JSON.parse(readFileSync(path.join(root, "genre-category-map.json"), "utf8"));
const csv = readFileSync(path.join(root, "genre-category-map.csv"), "utf8");
const routing = JSON.parse(readFileSync(path.join(root, "genre-routing-audit.json"), "utf8"));
const reviewCsv = readFileSync(path.join(root, "genre-manual-review.csv"), "utf8").replace(/^\uFEFF/u, "");
const errors = [];
if (raw.provider !== "javbus" || raw.kind !== "provider-genre-index-evidence") errors.push("原始快照类型或 Provider 不正确");
if (raw.itemCount !== raw.items?.length || raw.itemCount < 1) errors.push("原始快照计数不一致或为空");
if (map.sourceItemCount !== raw.itemCount) errors.push("分类映射与原始快照计数不一致");
if (map.uniqueItemCount !== map.items?.length) errors.push("分类映射唯一项计数不一致");
if (new Set(map.items.map((item) => `${normalize(item.sourceName)}\u0000${item.categoryId}`)).size !== map.items.length) errors.push("分类映射仍有重复名称/分类组合");
if (map.items.some((item) => !item.sourceName || !item.categoryId || !item.occurrences?.length)) errors.push("分类映射存在不完整条目");
if (raw.items.some((item) => !item.sourceId || !item.sourceName || !item.url.startsWith("https://www.javbus.com/"))) errors.push("原始快照存在不完整或越界 URL");
if (csv.trim().split(/\r?\n/u).length !== map.items.length + 1) errors.push("CSV 与 JSON 行数不一致");
if (routing.provider !== "javbus" || routing.kind !== "provider-classification-routing-audit") errors.push("Localogue 路由审计类型不正确");
const routedTotal = routing.genre + routing.workType + routing.sourceOnly + routing.review + routing.ambiguous + routing.unmapped;
if (routedTotal !== routing.input || routing.input > map.uniqueItemCount) errors.push("Localogue 路由审计计数不一致");
const reviewRows = reviewCsv.trim().split(/\r?\n/u);
if (reviewRows.length !== routing.review + routing.ambiguous + routing.unmapped + 1) errors.push("人工审核表与待处理路由计数不一致");
if (!reviewRows[0]?.includes("审核决定") || !reviewRows[0]?.includes("目标ID")) errors.push("人工审核表缺少可填写的决策列");
for (const page of raw.pages ?? []) if (!/^[a-f0-9]{64}$/u.test(page.sha256) || page.itemCount < 1) errors.push(`页面证据摘要非法：${page.url}`);
if (errors.length) { console.error("JavBus Genre 来源证据校验失败："); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
const digest = createHash("sha256").update(JSON.stringify(raw.items)).digest("hex").slice(0, 12);
console.log(`JavBus Genre 来源证据通过：raw ${raw.itemCount}，去重映射 ${map.uniqueItemCount}，来源冲突 ${map.conflicts.length}，digest ${digest}`);
function normalize(value) { return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN"); }
