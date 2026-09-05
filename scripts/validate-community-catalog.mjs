import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const catalogRoot = path.join(root, "resources", "catalogs");
const registryRoot = path.join(root, "resources", "registries");
const errors = [];

const readJson = (base, name) => JSON.parse(readFileSync(path.join(base, name), "utf8"));

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
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ""), values[index] ?? ""])));
};

const organizationsDocument = readJson(catalogRoot, "community-organizations.json");
const seriesDocument = readJson(catalogRoot, "community-series.json");
const organizationEvidence = readJson(registryRoot, "organization-source-evidence.json").items ?? [];
const seriesEvidence = readJson(registryRoot, "series-source-evidence.json").items ?? [];
const organizations = organizationsDocument.items ?? [];
const series = seriesDocument.items ?? [];

const organizationById = new Map();
for (const item of organizations) {
  if (item.schemaVersion !== 1) errors.push(`Community Organization schemaVersion 非法：${item.id}/${item.schemaVersion}`);
  if (!String(item.id ?? "").trim()) errors.push("Community Organization 缺少 id。");
  if (organizationById.has(item.id)) errors.push(`Community Organization ID 重复：${item.id}`);
  else organizationById.set(item.id, item);
  if (!["maker", "label"].includes(item.kind)) errors.push(`Community Organization kind 非法：${item.id}/${item.kind}`);
  if (item.kind === "maker" && !String(item.id).startsWith("maker_")) errors.push(`Maker ID 应使用 maker_ 前缀：${item.id}`);
  if (item.kind === "label" && !String(item.id).startsWith("label_")) errors.push(`Label ID 应使用 label_ 前缀：${item.id}`);
  if (!item.names || !Object.values(item.names).some((value) => String(value ?? "").trim())) errors.push(`Community Organization 缺少名称：${item.id}`);
  if (!Array.isArray(item.aliases)) errors.push(`Community Organization aliases 必须是数组：${item.id}`);
  if (item.status !== "active") errors.push(`Community Organization status 非法：${item.id}/${item.status}`);
}

for (const item of organizations) {
  if (!item.parentOrganizationId) continue;
  const parent = organizationById.get(item.parentOrganizationId);
  if (!parent) {
    errors.push(`Community Organization parent 不存在：${item.id} -> ${item.parentOrganizationId}`);
  } else if (item.kind === "label" && parent.kind !== "maker") {
    errors.push(`Community Label parent 必须是 Maker：${item.id} -> ${item.parentOrganizationId}`);
  }
}

const seriesById = new Map();
for (const item of series) {
  if (item.schemaVersion !== 1) errors.push(`Community Series schemaVersion 非法：${item.id}/${item.schemaVersion}`);
  if (!String(item.id ?? "").trim()) errors.push("Community Series 缺少 id。");
  if (seriesById.has(item.id)) errors.push(`Community Series ID 重复：${item.id}`);
  else seriesById.set(item.id, item);
  if (!String(item.id).startsWith("series_")) errors.push(`Series ID 应使用 series_ 前缀：${item.id}`);
  if (!item.names || !Object.values(item.names).some((value) => String(value ?? "").trim())) errors.push(`Community Series 缺少名称：${item.id}`);
  if (!Array.isArray(item.aliases)) errors.push(`Community Series aliases 必须是数组：${item.id}`);
  if (item.status !== "active") errors.push(`Community Series status 非法：${item.id}/${item.status}`);
  if (!item.parentOrganizationId) {
    errors.push(`V1-27C Community Series 必须有已审核 parentOrganizationId：${item.id}`);
  } else if (!organizationById.has(item.parentOrganizationId)) {
    errors.push(`Community Series parent 不存在：${item.id} -> ${item.parentOrganizationId}`);
  }
}

const catalogKindById = new Map([
  ...organizations.map((item) => [item.id, item.kind]),
  ...series.map((item) => [item.id, "series"]),
]);
const verifiedEvidenceCount = new Map();
for (const item of [...organizationEvidence, ...seriesEvidence]) {
  if (!item.canonicalId) continue;
  const kind = catalogKindById.get(item.canonicalId);
  if (!kind) {
    errors.push(`Registry canonicalId 未出现在 Community Catalog：${item.provider}/${item.entityKind}/${item.canonicalId}`);
    continue;
  }
  if (kind !== item.entityKind) errors.push(`Registry canonicalId kind 不匹配：${item.provider}/${item.entityKind}/${item.canonicalId} 实际=${kind}`);
  if (item.idStatus === "verified") verifiedEvidenceCount.set(item.canonicalId, (verifiedEvidenceCount.get(item.canonicalId) ?? 0) + 1);
}

for (const id of catalogKindById.keys()) {
  if (!verifiedEvidenceCount.get(id)) errors.push(`Community Catalog 实体缺少 verified Registry Evidence：${id}`);
}

const orgCsv = parseCsv(readFileSync(path.join(catalogRoot, "community-organizations.csv"), "utf8"));
const seriesCsv = parseCsv(readFileSync(path.join(catalogRoot, "community-series.csv"), "utf8"));
const expectedOrgRows = organizations.map((item) => ({
  id: item.id,
  kind: item.kind,
  name_ja: item.names?.ja ?? "",
  name_zh_cn: item.names?.["zh-CN"] ?? "",
  name_en: item.names?.en ?? "",
  aliases: (item.aliases ?? []).join(" | "),
  parentOrganizationId: item.parentOrganizationId ?? "",
  status: item.status ?? "",
}));
const expectedSeriesRows = series.map((item) => ({
  id: item.id,
  name_ja: item.names?.ja ?? "",
  name_zh_cn: item.names?.["zh-CN"] ?? "",
  name_en: item.names?.en ?? "",
  aliases: (item.aliases ?? []).join(" | "),
  parentOrganizationId: item.parentOrganizationId ?? "",
  status: item.status ?? "",
}));

const compareRows = (name, actual, expected) => {
  if (actual.length !== expected.length) {
    errors.push(`${name} 行数 ${actual.length} 与 JSON ${expected.length} 不一致。`);
    return;
  }
  for (let i = 0; i < expected.length; i += 1) {
    for (const [key, value] of Object.entries(expected[i])) {
      if (String(actual[i]?.[key] ?? "") !== String(value ?? "")) {
        errors.push(`${name} 第 ${i + 2} 行 ${key} 与 JSON 不一致。`);
        return;
      }
    }
  }
};
compareRows("community-organizations.csv", orgCsv, expectedOrgRows);
compareRows("community-series.csv", seriesCsv, expectedSeriesRows);

if (errors.length) {
  console.error("Community catalog validation failed:\n" + errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("✓ Community catalog validation passed");
console.log(`  Makers: ${organizations.filter((item) => item.kind === "maker").length}`);
console.log(`  Labels: ${organizations.filter((item) => item.kind === "label").length}`);
console.log(`  Series: ${series.length}`);
console.log(`  Canonical entities: ${catalogKindById.size}`);
console.log(`  Mapped Registry Evidence: ${[...organizationEvidence, ...seriesEvidence].filter((item) => item.canonicalId).length}`);
