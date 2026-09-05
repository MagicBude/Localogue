import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const registryRoot = path.join(root, "resources", "registries");
const errors = [];
const loadJson = (name) => JSON.parse(readFileSync(path.join(registryRoot, name), "utf8"));

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter((item) => item.some((value) => value !== ""));
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
};

const assertCsvMatches = (csvName, items, columns) => {
  const rows = parseCsv(readFileSync(path.join(registryRoot, csvName), "utf8"));
  if (rows.length !== items.length) {
    errors.push(`${csvName} 行数 ${rows.length} 与 JSON ${items.length} 不一致。`);
    return;
  }
  for (let i = 0; i < items.length; i += 1) {
    for (const column of columns) {
      const raw = items[i]?.[column];
      const expected = typeof raw === "boolean" ? String(raw) : String(raw ?? "");
      if (String(rows[i]?.[column] ?? "") !== expected) {
        errors.push(`${csvName} 第 ${i + 2} 行 ${column} 与 JSON 不一致。`);
        return;
      }
    }
  }
};

const sources = loadJson("provider-entity-sources.json");
const organizationEvidence = loadJson("organization-source-evidence.json");
const seriesEvidence = loadJson("series-source-evidence.json");
const seenProvider = new Set();

for (const item of sources.items ?? []) {
  if (!String(item.provider ?? "").trim()) errors.push("Provider 缺少 provider key。");
  if (seenProvider.has(item.provider)) errors.push(`Provider 重复：${item.provider}`);
  else seenProvider.add(item.provider);
  if (!item.catalogStatus) errors.push(`Provider 缺少 catalogStatus：${item.provider}`);
  if (typeof item.stableIds !== "boolean") errors.push(`Provider stableIds 必须是 boolean：${item.provider}`);
  if (typeof item.requiresCredentials !== "boolean") errors.push(`Provider requiresCredentials 必须是 boolean：${item.provider}`);
}

const validProviders = seenProvider;
const idOwners = new Set();
const validateEvidence = (items, allowedKinds, sourceName) => {
  const seenNameEvidence = new Set();
  for (const item of items ?? []) {
    if (!validProviders.has(item.provider)) errors.push(`${sourceName} Provider 非法：${item.provider}`);
    if (!allowedKinds.includes(item.entityKind)) errors.push(`${sourceName} entityKind 非法：${item.entityKind}`);
    if (!String(item.name ?? "").trim()) errors.push(`${sourceName} 缺少 name：${item.provider}`);
    if (!["verified", "name-only"].includes(item.idStatus)) errors.push(`${sourceName} idStatus 非法：${item.provider}/${item.name}`);
    if (item.idStatus === "verified" && !String(item.sourceId ?? "").trim()) {
      errors.push(`verified ${sourceName} 必须有 sourceId：${item.provider}/${item.name}`);
    }
    if (item.idStatus === "name-only" && String(item.sourceId ?? "").trim()) {
      errors.push(`name-only ${sourceName} 不应伪造 sourceId：${item.provider}/${item.name}`);
    }
    if (item.sourceId) {
      const key = `${item.provider}::${item.entityKind}::${item.sourceId}`;
      if (idOwners.has(key)) errors.push(`Provider/entityKind/sourceId 重复：${key}`);
      else idOwners.add(key);
    } else {
      const nameKey = `${item.provider}::${item.entityKind}::${String(item.name).normalize("NFKC").trim().toLowerCase()}`;
      if (seenNameEvidence.has(nameKey)) errors.push(`${sourceName} name-only 重复：${nameKey}`);
      else seenNameEvidence.add(nameKey);
    }
  }
};

validateEvidence(organizationEvidence.items, ["maker", "label"], "Organization Evidence");
validateEvidence(seriesEvidence.items, ["series"], "Series Evidence");

assertCsvMatches("provider-entity-sources.csv", sources.items ?? [], [
  "provider", "sourceType", "organizationSupport", "seriesSupport", "stableIds", "catalogStatus", "requiresCredentials", "notesZh",
]);
assertCsvMatches("organization-source-evidence.csv", organizationEvidence.items ?? [], [
  "provider", "entityKind", "sourceId", "name", "idStatus", "canonicalId", "evidence", "noteZh",
]);
assertCsvMatches("series-source-evidence.csv", seriesEvidence.items ?? [], [
  "provider", "entityKind", "sourceId", "name", "idStatus", "canonicalId", "evidence", "noteZh",
]);

if (errors.length) {
  console.error("Entity registry validation failed:\n" + errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

const allEvidence = [...(organizationEvidence.items ?? []), ...(seriesEvidence.items ?? [])];
console.log("✓ Entity registry validation passed");
console.log(`  Provider capabilities: ${(sources.items ?? []).length}`);
console.log(`  Organization evidence: ${(organizationEvidence.items ?? []).length}`);
console.log(`  Series evidence: ${(seriesEvidence.items ?? []).length}`);
console.log(`  Verified provider IDs: ${allEvidence.filter((item) => item.idStatus === "verified").length}`);
console.log(`  Name-only evidence: ${allEvidence.filter((item) => item.idStatus === "name-only").length}`);
