import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const vocabRoot = path.join(root, "resources", "vocabularies");
const errors = [];

const loadJson = (name) => JSON.parse(readFileSync(path.join(vocabRoot, name), "utf8"));
const norm = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");

const genres = loadJson("genres.json");
const workTypes = loadJson("work-types.json");
const sourceOnly = loadJson("source-only-classifications.json");
const aliases = loadJson("classification-term-aliases.json");
const crosswalk = loadJson("community-classification-crosswalk.json");
const providerAliases = loadJson("genre-source-aliases.json");

const requireLocalized = (kind, items) => {
  const ids = new Set();
  for (const item of items) {
    if (!item?.id || typeof item.id !== "string") {
      errors.push(`${kind}: 缺少稳定 id。`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${kind}: 重复 id ${item.id}`);
    ids.add(item.id);
    for (const language of ["ja", "zh-CN", "en"]) {
      if (typeof item[language] !== "string" || !item[language].trim()) {
        errors.push(`${kind}:${item.id} 缺少 ${language}。`);
      }
    }
  }
  return ids;
};

const genreIds = requireLocalized("Genre", genres.items ?? []);
const workTypeIds = requireLocalized("WorkType", workTypes.items ?? []);
const sourceOnlyIds = requireLocalized("SourceOnly", sourceOnly.items ?? []);

if (genreIds.size < 320) errors.push(`Genre 覆盖回退：当前 ${genreIds.size}，期望至少 320。`);
if (workTypeIds.size < 43) errors.push(`Work Type 覆盖回退：当前 ${workTypeIds.size}，期望至少 43。`);
if (sourceOnlyIds.size < 46) errors.push(`Source-only 覆盖回退：当前 ${sourceOnlyIds.size}，期望至少 46。`);
if ((crosswalk.items ?? []).length < 323) errors.push(`Community Crosswalk 覆盖回退：当前 ${(crosswalk.items ?? []).length}，期望至少 323。`);

const legacyGenreIds = [
  "uniform", "office_lady", "married_woman", "mature", "amateur", "big_bust", "small_bust", "slender",
  "cosplay", "drama", "documentary", "lesbian", "beautiful_girl", "pov", "squirting", "blowjob",
  "masturbation", "orgasm", "creampie", "maid", "nurse", "female_teacher", "abuse", "kissing", "titjob",
  "cowgirl", "handjob", "facial", "cum_swallowing", "anal", "bondage", "sm", "voyeurism",
];
for (const id of legacyGenreIds) if (!genreIds.has(id)) errors.push(`稳定 Genre ID 被删除：${id}`);
for (const id of ["solo", "co_starring", "vr", "image_video", "compilation", "omnibus", "best_of", "other"]) {
  if (!workTypeIds.has(id)) errors.push(`稳定 Work Type ID 被删除：${id}`);
}

const targetExists = (target) => {
  const [kind, ...rest] = String(target).split(":");
  const id = rest.join(":");
  if (kind === "genre") return genreIds.has(id);
  if (kind === "workType") return workTypeIds.has(id);
  if (kind === "sourceOnly") return sourceOnlyIds.has(id);
  return false;
};

const approvedOwner = new Map();
for (const item of aliases.items ?? []) {
  const key = norm(item.term);
  if (!key) errors.push("classification-term-aliases: 存在空 term。");
  if (item.status === "approved") {
    if (!Array.isArray(item.targets) || item.targets.length !== 1) {
      errors.push(`approved alias 必须恰好一个 target：${item.term}`);
      continue;
    }
    if ((item.candidateTargets ?? []).length) errors.push(`approved alias 不应同时有 candidateTargets：${item.term}`);
    const target = item.targets[0];
    if (!targetExists(target)) errors.push(`alias target 不存在：${item.term} -> ${target}`);
    const existing = approvedOwner.get(key);
    if (existing && existing !== target) errors.push(`同一精确 alias 指向多个 Canonical：${item.term} -> ${existing} / ${target}`);
    else approvedOwner.set(key, target);
  } else if (item.status === "review-required") {
    if ((item.targets ?? []).length) errors.push(`review-required 不得自动 target：${item.term}`);
    if (!Array.isArray(item.candidateTargets) || !item.candidateTargets.length) errors.push(`review-required 缺少候选：${item.term}`);
    for (const target of item.candidateTargets ?? []) if (!targetExists(target)) errors.push(`review candidate 不存在：${item.term} -> ${target}`);
  } else {
    errors.push(`未知 alias status：${item.term} -> ${item.status}`);
  }
}

const communityIds = new Set();
for (const item of crosswalk.items ?? []) {
  if (!item.communityId || communityIds.has(item.communityId)) errors.push(`Community Crosswalk ID 重复/缺失：${item.communityId}`);
  communityIds.add(item.communityId);
  if (!item.target?.kind || !item.target?.id) {
    errors.push(`Community Crosswalk target 缺失：${item.communityId}`);
    continue;
  }
  const target = `${item.target.kind}:${item.target.id}`;
  if (!targetExists(target)) errors.push(`Community Crosswalk target 不存在：${item.communityId} -> ${target}`);
}

const validIdSources = new Set(["fanza", "javbus", "javdb", "javlibrary"]);
const providerIdOwners = new Map();
for (const item of providerAliases.items ?? []) {
  if (!genreIds.has(item.canonicalId)) errors.push(`Provider Genre Alias 指向未知 Genre：${item.sourceId} -> ${item.canonicalId}`);
  if (!item.sourceId || typeof item.sourceId !== "string") errors.push(`Provider Genre Alias 缺少 sourceId：${item.canonicalId}`);
  if (item.idSource !== null && item.idSource !== undefined) {
    if (!validIdSources.has(item.idSource)) errors.push(`Provider Genre Alias idSource 非法：${item.sourceId} -> ${item.idSource}`);
    const provenanceNames = new Set(item.sources ?? []);
    const provenanceKey = item.idSource === "javlibrary" ? "javlib" : item.idSource;
    if (!provenanceNames.has(provenanceKey)) errors.push(`Provider Genre Alias idSource 未出现在 sources Evidence：${item.sourceId} -> ${item.idSource}`);
    const ownerKey = `${item.idSource}::${item.sourceId}`;
    if (providerIdOwners.has(ownerKey)) errors.push(`Provider Genre Alias Provider/sourceId 重复：${ownerKey}`);
    else providerIdOwners.set(ownerKey, item);
  }
  if (item.idSource == null && item.idStatus !== "legacy-unscoped") {
    errors.push(`未归属 Provider 的 legacy sourceId 必须标记 legacy-unscoped：${item.sourceId}`);
  }
}

const exactExpectations = new Map([
  ["主観", "genre:pov"],
  ["POV", "genre:pov"],
  ["ハメ撮り", "genre:pov_recording"],
  ["中出し", "genre:creampie"],
  ["Blu-ray（ブルーレイ）", "sourceOnly:media_blu_ray"],
  ["フルハイビジョン(FHD)", "sourceOnly:media_full_hd"],
  ["単体作品", "workType:solo"],
]);
for (const [term, target] of exactExpectations) {
  const actual = approvedOwner.get(norm(term));
  if (actual !== target) errors.push(`关键映射回归：${term} 期望 ${target}，实际 ${actual ?? "unmapped"}`);
}

for (const compound of ["寝取り、寝取られ", "女装・男の娘", "ベスト、総集編", "サイコ、スリラー", "体操着・ブルマ"]) {
  if (approvedOwner.has(norm(compound))) errors.push(`复合词不得自动写入：${compound}`);
}

const providerHamedori = (providerAliases.items ?? []).find((item) => item.ja === "ハメ撮り" && item.sourceId === "1g");
if (providerHamedori?.canonicalId !== "pov_recording") {
  errors.push("Provider alias 1g / ハメ撮り 必须映射 pov_recording，而不是 pov。");
}

const assertCsvMatchesJson = (csvName, jsonItems, columns) => {
  const rows = parseCsv(readFileSync(path.join(vocabRoot, csvName), "utf8"));
  if (rows.length !== jsonItems.length) {
    errors.push(`${csvName} 行数 ${rows.length} 与 JSON ${jsonItems.length} 不一致。`);
    return;
  }
  for (let i = 0; i < rows.length; i += 1) {
    for (const column of columns) {
      const jsonValue = jsonItems[i]?.[column];
      const expected = Array.isArray(jsonValue) ? jsonValue.join("|") : String(jsonValue ?? "");
      if (String(rows[i]?.[column] ?? "") !== expected) {
        errors.push(`${csvName} 第 ${i + 2} 行 ${column} 与 JSON 不一致。`);
        return;
      }
    }
  }
};
assertCsvMatchesJson("genres.csv", genres.items ?? [], ["id", "ja", "zh-CN", "en", "facets", "communityGenreIds"]);
assertCsvMatchesJson("work-types.csv", workTypes.items ?? [], ["id", "ja", "zh-CN", "en", "descriptionZh", "communityGenreIds"]);
assertCsvMatchesJson("source-only-classifications.csv", sourceOnly.items ?? [], ["id", "category", "ja", "zh-CN", "en", "aliases", "communityGenreIds"]);

const providerAliasCsvRows = parseCsv(readFileSync(path.join(vocabRoot, "genre-source-aliases.csv"), "utf8"));
if (providerAliasCsvRows.length !== (providerAliases.items ?? []).length) {
  errors.push(`genre-source-aliases.csv 行数 ${providerAliasCsvRows.length} 与 JSON ${(providerAliases.items ?? []).length} 不一致。`);
} else {
  for (let i = 0; i < providerAliasCsvRows.length; i += 1) {
    const jsonItem = providerAliases.items[i];
    const csvItem = providerAliasCsvRows[i];
    const expected = {
      canonicalId: jsonItem.canonicalId,
      sourceId: jsonItem.sourceId,
      idSource: jsonItem.idSource ?? "",
      idStatus: jsonItem.idStatus ?? "",
      ja: jsonItem.ja,
      "zh-CN": jsonItem["zh-CN"],
      en: jsonItem.en,
      sources: (jsonItem.sources ?? []).join(";"),
      note: jsonItem.note ?? "",
    };
    if (Object.entries(expected).some(([key, value]) => String(csvItem[key] ?? "") !== String(value ?? ""))) {
      errors.push(`genre-source-aliases.csv 第 ${i + 2} 行与 JSON 不一致。`);
      break;
    }
  }
}

const aliasCsvRows = parseCsv(readFileSync(path.join(vocabRoot, "classification-term-aliases.csv"), "utf8"));
if (aliasCsvRows.length !== (aliases.items ?? []).length) {
  errors.push(`classification-term-aliases.csv 行数 ${aliasCsvRows.length} 与 JSON ${(aliases.items ?? []).length} 不一致。`);
} else {
  for (let i = 0; i < aliasCsvRows.length; i += 1) {
    const jsonItem = aliases.items[i];
    const csvItem = aliasCsvRows[i];
    const pairs = [
      ["term", jsonItem.term],
      ["status", jsonItem.status],
      ["targets", (jsonItem.targets ?? []).join("|")],
      ["candidateTargets", (jsonItem.candidateTargets ?? []).join("|")],
      ["sources", (jsonItem.sources ?? []).join("|")],
      ["note", jsonItem.note ?? ""],
    ];
    if (pairs.some(([key, value]) => String(csvItem[key] ?? "") !== String(value ?? ""))) {
      errors.push(`classification-term-aliases.csv 第 ${i + 2} 行与 JSON 不一致。`);
      break;
    }
  }
}

const crosswalkCsvRows = parseCsv(readFileSync(path.join(vocabRoot, "community-classification-crosswalk.csv"), "utf8"));
if (crosswalkCsvRows.length !== (crosswalk.items ?? []).length) {
  errors.push(`community-classification-crosswalk.csv 行数 ${crosswalkCsvRows.length} 与 JSON ${(crosswalk.items ?? []).length} 不一致。`);
} else {
  for (let i = 0; i < crosswalkCsvRows.length; i += 1) {
    const jsonItem = crosswalk.items[i];
    const csvItem = crosswalkCsvRows[i];
    const expected = {
      communityId: jsonItem.communityId,
      facet: jsonItem.facet,
      assignmentTarget: jsonItem.assignmentTarget,
      ja: jsonItem.names?.ja ?? "",
      "zh-CN": jsonItem.names?.["zh-CN"] ?? "",
      en: jsonItem.names?.en ?? "",
      targetKind: jsonItem.target?.kind ?? "",
      targetId: jsonItem.target?.id ?? "",
      decision: jsonItem.decision ?? "",
    };
    if (Object.entries(expected).some(([key, value]) => String(csvItem[key] ?? "") !== String(value ?? ""))) {
      errors.push(`community-classification-crosswalk.csv 第 ${i + 2} 行与 JSON 不一致。`);
      break;
    }
  }
}


const providerCatalogRoot = path.join(vocabRoot, "provider-genre-catalogs");
for (const provider of ["fanza", "javlibrary", "javbus", "javdb"]) {
  const jsonPath = path.join(providerCatalogRoot, `${provider}.json`);
  const csvPath = path.join(providerCatalogRoot, `${provider}.csv`);
  const catalog = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (catalog.provider !== provider) errors.push(`Provider Catalog provider 不一致：${provider} -> ${catalog.provider}`);
  if (!catalog.snapshot || !catalog.catalogStatus) errors.push(`Provider Catalog 缺少 snapshot/catalogStatus：${provider}`);
  const items = catalog.items ?? [];
  if (!items.length) errors.push(`Provider Catalog 为空：${provider}`);
  const seenTerms = new Set();
  const seenSourceIds = new Set();
  for (const item of items) {
    const key = norm(item.ja);
    if (!key) errors.push(`Provider Catalog 存在空 ja：${provider}`);
    else if (seenTerms.has(key)) errors.push(`Provider Catalog 重复 ja：${provider} / ${item.ja}`);
    else seenTerms.add(key);
    if (item.sourceId !== null && item.sourceId !== undefined && item.sourceId !== "") {
      const sourceId = String(item.sourceId);
      if (seenSourceIds.has(sourceId)) errors.push(`Provider Catalog 重复 sourceId：${provider} / ${sourceId}`);
      else seenSourceIds.add(sourceId);
      const ownedElsewhere = [...providerIdOwners.keys()]
        .filter((key) => key.endsWith(`::${sourceId}`) && !key.startsWith(`${provider}::`));
      const ownedHere = providerIdOwners.has(`${provider}::${sourceId}`);
      if (ownedElsewhere.length && !ownedHere) {
        errors.push(`Provider Catalog sourceId 归属冲突：${provider} / ${sourceId}，Approved Alias owner=${ownedElsewhere.join(",")}`);
      }
      if (item.idStatus === "verified-alias" && !ownedHere) {
        errors.push(`Provider Catalog verified-alias 缺少同 Provider Approved Alias：${provider} / ${sourceId}`);
      }
    }
  }
  const csvRows = parseCsv(readFileSync(csvPath, "utf8"));
  if (csvRows.length !== items.length) {
    errors.push(`Provider Catalog CSV 行数不一致：${provider} JSON ${items.length} / CSV ${csvRows.length}`);
  } else {
    const columns = ["sourceId", "ja", "zh-CN", "en", "sourceGroup", "canonicalId", "idStatus"];
    for (let i = 0; i < items.length; i += 1) {
      if (columns.some((column) => String(csvRows[i]?.[column] ?? "") !== String(items[i]?.[column] ?? ""))) {
        errors.push(`Provider Catalog CSV 与 JSON 不一致：${provider} 第 ${i + 2} 行。`);
        break;
      }
    }
  }
}

if (errors.length) {
  console.error("Vocabulary validation failed:\n" + errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

const aliasStatus = countBy(aliases.items ?? [], (item) => item.status);
console.log("✓ Vocabulary validation passed");
console.log(`  Canonical Genre: ${genreIds.size}`);
console.log(`  Work Type: ${workTypeIds.size}`);
console.log(`  Source-only: ${sourceOnlyIds.size}`);
console.log(`  Community Crosswalk: ${communityIds.size}`);
console.log(`  Exact aliases: approved ${aliasStatus.get("approved") ?? 0}, review ${aliasStatus.get("review-required") ?? 0}`);

function countBy(items, keyFor) {
  const result = new Map();
  for (const item of items) {
    const key = keyFor(item);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows.filter((values) => values.some((value) => value !== "")).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
