import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const errors = [];

const genreDocument = readJson("resources/vocabularies/genres.json");
const workTypeDocument = readJson("resources/vocabularies/work-types.json");
const sourceOnlyDocument = readJson("resources/vocabularies/source-only-classifications.json");
const termAliasDocument = readJson("resources/vocabularies/classification-term-aliases.json");
const communityCrosswalkDocument = readJson("resources/vocabularies/community-classification-crosswalk.json");
const providerAliasDocument = readJson("resources/vocabularies/genre-source-aliases.json");

const genres = genreDocument.items ?? [];
const workTypes = workTypeDocument.items ?? [];
const sourceOnly = sourceOnlyDocument.items ?? [];
const termAliases = termAliasDocument.items ?? [];
const communityCrosswalk = communityCrosswalkDocument.items ?? [];
const providerAliases = providerAliasDocument.items ?? [];

const expectedCounts = {
  genres: 320,
  workTypes: 43,
  sourceOnly: 38,
  termAliases: 150,
  communityCrosswalk: 323,
};
for (const [label, actual] of [
  ["Canonical Genre", genres.length],
  ["Work Type", workTypes.length],
  ["Source-only", sourceOnly.length],
  ["Classification Term Alias", termAliases.length],
  ["Community Crosswalk", communityCrosswalk.length],
]) {
  const key = label === "Canonical Genre" ? "genres" : label === "Work Type" ? "workTypes" : label === "Source-only" ? "sourceOnly" : label === "Classification Term Alias" ? "termAliases" : "communityCrosswalk";
  if (actual !== expectedCounts[key]) errors.push(`${label} 数量应为 ${expectedCounts[key]}，当前 ${actual}。`);
}

const stableGenreIds = [
  "uniform", "office_lady", "married_woman", "mature", "amateur", "big_bust", "small_bust", "slender", "cosplay", "drama", "documentary", "lesbian", "beautiful_girl", "pov", "squirting", "blowjob", "masturbation", "orgasm", "creampie", "maid", "nurse", "female_teacher", "abuse", "kissing", "titjob", "cowgirl", "handjob", "facial", "cum_swallowing", "anal", "bondage", "sm", "voyeurism",
];
const stableWorkTypeIds = ["solo", "co_starring", "vr", "image_video", "compilation", "omnibus", "best_of", "other"];

function validateLocalizedItems(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || !/^[a-z][a-z0-9_]*$/.test(item.id)) errors.push(`${label} ID 非法：${String(item.id)}`);
    if (ids.has(item.id)) errors.push(`${label} ID 重复：${item.id}`);
    ids.add(item.id);
    for (const field of ["ja", "zh-CN", "en"]) {
      if (!String(item[field] ?? "").trim()) errors.push(`${label} ${item.id} 缺少 ${field}`);
    }
  }
  return ids;
}

const genreIds = validateLocalizedItems(genres, "Genre");
const workTypeIds = validateLocalizedItems(workTypes, "Work Type");
const sourceOnlyIds = validateLocalizedItems(sourceOnly, "Source-only");
for (const id of stableGenreIds) if (!genreIds.has(id)) errors.push(`历史稳定 Genre ID 不得移除：${id}`);
for (const id of stableWorkTypeIds) if (!workTypeIds.has(id)) errors.push(`历史稳定 Work Type ID 不得移除：${id}`);
for (const id of sourceOnlyIds) if (genreIds.has(id) || workTypeIds.has(id)) errors.push(`Source-only ID 不得与 Canonical 维度重名：${id}`);

const normalizedTargets = new Map();
function addDirectTerm(value, target) {
  const key = termKey(value);
  if (!key) return;
  const targets = normalizedTargets.get(key) ?? new Set();
  targets.add(target);
  normalizedTargets.set(key, targets);
}
for (const item of genres) for (const value of [item.ja, item["zh-CN"], item.en]) addDirectTerm(value, `genre:${item.id}`);
for (const item of workTypes) for (const value of [item.ja, item["zh-CN"], item.en, ...(item.aliases ?? [])]) addDirectTerm(value, `workType:${item.id}`);
for (const item of sourceOnly) for (const value of [item.ja, item["zh-CN"], item.en, ...(item.aliases ?? [])]) addDirectTerm(value, `sourceOnly:${item.id}`);

const validTarget = (target) => {
  if (typeof target !== "string") return false;
  const index = target.indexOf(":");
  if (index <= 0) return false;
  const kind = target.slice(0, index);
  const id = target.slice(index + 1);
  return kind === "genre" ? genreIds.has(id) : kind === "workType" ? workTypeIds.has(id) : kind === "sourceOnly" ? sourceOnlyIds.has(id) : false;
};

const termKeys = new Set();
for (const item of termAliases) {
  const key = termKey(item.term ?? "");
  if (!key) errors.push("Classification Term Alias 存在空 term。");
  if (termKeys.has(key)) errors.push(`Classification Term Alias 规范化后重复：${item.term}`);
  termKeys.add(key);
  if (item.status === "approved") {
    if (!Array.isArray(item.targets) || !item.targets.length) errors.push(`Approved alias 缺少 targets：${item.term}`);
    for (const target of item.targets ?? []) if (!validTarget(target)) errors.push(`Alias ${item.term} 指向不存在目标：${target}`);
  } else if (item.status === "review-required") {
    if (!Array.isArray(item.candidateTargets) || !item.candidateTargets.length) errors.push(`Review-required alias 缺少候选：${item.term}`);
    for (const target of item.candidateTargets ?? []) if (!validTarget(target)) errors.push(`Review alias ${item.term} 候选不存在：${target}`);
  } else {
    errors.push(`Classification Term Alias status 非法：${item.term} -> ${item.status}`);
  }
}
for (const ignored of termAliasDocument.ignoredTerms ?? []) {
  if (termKeys.has(termKey(ignored))) errors.push(`ignoredTerms 不得与显式 Alias 重复：${ignored}`);
}

for (const [key, targets] of normalizedTargets) {
  if (targets.size <= 1) continue;
  const explicit = termAliases.find((item) => termKey(item.term) === key && item.status === "approved");
  if (!explicit) errors.push(`Canonical 名称/别名发生歧义且没有显式规则：${key} -> ${[...targets].join(", ")}`);
}

const providerKeys = new Set();
for (const item of providerAliases) {
  if (!genreIds.has(item.canonicalId)) errors.push(`Provider Genre Alias 指向不存在 Genre：${item.canonicalId}`);
  const key = `${item.canonicalId}::${item.sourceId}`;
  if (!item.sourceId || providerKeys.has(key)) errors.push(`Provider Genre Alias 缺失或重复：${key}`);
  providerKeys.add(key);
}
if (providerAliases.length < 67) errors.push(`Provider Genre Alias 不应少于历史 67 条，当前 ${providerAliases.length}。`);

const crosswalkIds = new Set();
const crosswalkCounts = { genre: 0, workType: 0, sourceOnly: 0 };
for (const item of communityCrosswalk) {
  if (!/^genre_\d{6}$/.test(item.communityId ?? "")) errors.push(`Community ID 非法：${item.communityId}`);
  if (crosswalkIds.has(item.communityId)) errors.push(`Community Crosswalk ID 重复：${item.communityId}`);
  crosswalkIds.add(item.communityId);
  const target = `${item.targetKind}:${item.targetId}`;
  if (!validTarget(target)) errors.push(`Community Crosswalk 目标不存在：${item.communityId} -> ${target}`);
  if (item.targetKind in crosswalkCounts) crosswalkCounts[item.targetKind] += 1;
  else errors.push(`Community Crosswalk targetKind 非法：${item.communityId} -> ${item.targetKind}`);
}
for (let i = 1; i <= 323; i += 1) {
  const id = `genre_${String(i).padStart(6, "0")}`;
  if (!crosswalkIds.has(id)) errors.push(`Community Crosswalk 缺少：${id}`);
}
if (crosswalkCounts.genre !== 264 || crosswalkCounts.workType !== 38 || crosswalkCounts.sourceOnly !== 21) {
  errors.push(`Community Crosswalk 分流数量异常：${JSON.stringify(crosswalkCounts)}，期望 genre=264 / workType=38 / sourceOnly=21。`);
}

const csvMirrors = [
  ["genres", genres.length, "resources/vocabularies/genres.csv"],
  ["work-types", workTypes.length, "resources/vocabularies/work-types.csv"],
  ["source-only-classifications", sourceOnly.length, "resources/vocabularies/source-only-classifications.csv"],
  ["classification-term-aliases", termAliases.length, "resources/vocabularies/classification-term-aliases.csv"],
  ["community-classification-crosswalk", communityCrosswalk.length, "resources/vocabularies/community-classification-crosswalk.csv"],
];
for (const [label, count, relative] of csvMirrors) {
  const lines = readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "").replace(/\r/g, "").trim().split("\n").filter(Boolean);
  if (lines.length !== count + 1) errors.push(`${label} CSV 与 JSON 数量不一致：JSON ${count}，CSV ${Math.max(0, lines.length - 1)}。`);
}

if (errors.length) {
  console.error("Vocabulary validation failed:\n" + errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Vocabulary validation passed.");
console.log(`- Canonical Genre: ${genres.length}`);
console.log(`- Work Type: ${workTypes.length}`);
console.log(`- Recognized source-only: ${sourceOnly.length}`);
console.log(`- Reviewed term aliases: ${termAliases.length}`);
console.log(`- Community crosswalk: ${communityCrosswalk.length}/323`);

function termKey(value) {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");
}
