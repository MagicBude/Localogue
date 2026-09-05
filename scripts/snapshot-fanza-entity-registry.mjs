import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const API_BASE = "https://api.dmm.com/affiliate/v3";
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const hasFlag = (flag) => args.includes(flag);
const floorId = String(getArg("--floor", "91"));
const kindArg = getArg("--kind", "both");
const inputPath = getArg("--input", null);
const outputPath = path.resolve(process.cwd(), getArg("--output", `var/provider-registry/fanza-floor-${floorId}.json`));
const hits = Math.min(Math.max(Number(getArg("--hits", "100")) || 100, 1), 100);
const maxPages = Math.max(Number(getArg("--max-pages", "500")) || 500, 1);
const requestedKinds = kindArg === "both" ? ["maker", "series"] : [kindArg];
if (requestedKinds.some((kind) => !["maker", "series"].includes(kind))) {
  console.error("--kind 只支持 maker / series / both");
  process.exit(2);
}

const stringOrNull = (value) => value === undefined || value === null || value === "" ? null : String(value);
const normalizeRawItems = (raw, kind, floorMeta = {}) => {
  const result = raw?.result ?? raw ?? {};
  const container = result?.[kind];
  const rawItems = Array.isArray(container) ? container : Array.isArray(container?.item) ? container.item : [];
  return rawItems.map((item) => ({
    provider: "fanza",
    entityKind: kind,
    sourceId: stringOrNull(item?.[`${kind}_id`] ?? item?.id),
    name: stringOrNull(item?.name),
    ruby: stringOrNull(item?.ruby),
    listUrl: stringOrNull(item?.list_url ?? item?.listUrl),
    idStatus: "verified",
    floorId: stringOrNull(result.floor_id ?? floorMeta.floorId),
    floorName: stringOrNull(result.floor_name ?? floorMeta.floorName),
    floorCode: stringOrNull(result.floor_code ?? floorMeta.floorCode),
  })).filter((item) => item.sourceId && item.name);
};

const pageMeta = (raw) => {
  const result = raw?.result ?? raw ?? {};
  return {
    resultCount: Number(result.result_count ?? 0),
    totalCount: Number(result.total_count ?? 0),
    firstPosition: Number(result.first_position ?? 0),
    floorId: stringOrNull(result.floor_id),
    floorName: stringOrNull(result.floor_name),
    floorCode: stringOrNull(result.floor_code),
  };
};

const normalizeInput = (payload) => {
  const items = [];
  const totals = {};
  for (const kind of requestedKinds) {
    const pages = Array.isArray(payload?.[kind]) ? payload[kind] : [payload];
    let totalCount = 0;
    for (const raw of pages) {
      const meta = pageMeta(raw);
      totalCount = Math.max(totalCount, meta.totalCount);
      items.push(...normalizeRawItems(raw, kind, meta));
    }
    totals[kind] = { totalCount, fetchedCount: items.filter((item) => item.entityKind === kind).length };
  }
  return { items, totals };
};

const fetchKind = async (kind) => {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;
  if (!apiId || !affiliateId) {
    console.error("缺少 DMM_API_ID / DMM_AFFILIATE_ID 环境变量。凭证不会写入仓库或命令行参数。");
    process.exit(2);
  }
  const operation = kind === "maker" ? "MakerSearch" : "SeriesSearch";
  const all = [];
  let totalCount = null;
  let offset = 1;
  let floorMeta = { floorId };
  let page = 0;
  let stoppedByOffsetLimit = false;

  while (page < maxPages) {
    if (offset > 50000) {
      stoppedByOffsetLimit = true;
      break;
    }
    page += 1;
    const url = new URL(`${API_BASE}/${operation}`);
    url.searchParams.set("api_id", apiId);
    url.searchParams.set("affiliate_id", affiliateId);
    url.searchParams.set("floor_id", floorId);
    url.searchParams.set("hits", String(hits));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("output", "json");

    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`${operation} HTTP ${response.status}`);
    const raw = await response.json();
    const result = raw?.result ?? {};
    if (Number(result.status ?? 200) >= 400) throw new Error(`${operation} API status ${result.status}: ${result.message ?? "unknown error"}`);
    const meta = pageMeta(raw);
    floorMeta = { floorId: meta.floorId ?? floorId, floorName: meta.floorName, floorCode: meta.floorCode };
    if (totalCount === null && Number.isFinite(meta.totalCount)) totalCount = meta.totalCount;
    const pageItems = normalizeRawItems(raw, kind, floorMeta);
    all.push(...pageItems);
    if (!pageItems.length || (totalCount !== null && all.length >= totalCount)) break;
    offset += hits;
  }

  const unique = new Map();
  for (const item of all) unique.set(item.sourceId, item);
  const items = [...unique.values()];
  return {
    items,
    totalCount: totalCount ?? items.length,
    fetchedCount: items.length,
    complete: !stoppedByOffsetLimit && (totalCount === null || items.length >= totalCount),
    stoppedByOffsetLimit,
    floorMeta,
  };
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeSnapshot = (snapshot) => {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  const csvPath = /\.json$/i.test(outputPath) ? outputPath.replace(/\.json$/i, ".csv") : `${outputPath}.csv`;
  const columns = ["provider", "entityKind", "sourceId", "name", "ruby", "listUrl", "idStatus", "floorId", "floorName", "floorCode"];
  const lines = [columns.join(","), ...snapshot.items.map((item) => columns.map((column) => csvEscape(item[column])).join(","))];
  writeFileSync(csvPath, lines.join("\n") + "\n", "utf8");
  console.log(`✓ FANZA registry snapshot written\n  JSON: ${outputPath}\n  CSV:  ${csvPath}`);
  for (const kind of requestedKinds) {
    const stat = snapshot.coverage[kind];
    console.log(`  ${kind}: ${stat.fetchedCount}/${stat.totalCount}${stat.complete ? " (complete for requested floor)" : " (partial)"}`);
  }
};

try {
  let items = [];
  const coverage = {};
  if (inputPath) {
    const payload = JSON.parse(readFileSync(path.resolve(process.cwd(), inputPath), "utf8"));
    const normalized = normalizeInput(payload);
    items = normalized.items;
    for (const kind of requestedKinds) {
      const stat = normalized.totals[kind];
      coverage[kind] = { ...stat, complete: stat.totalCount > 0 ? stat.fetchedCount >= stat.totalCount : false, source: "input" };
    }
  } else {
    for (const kind of requestedKinds) {
      const result = await fetchKind(kind);
      items.push(...result.items);
      coverage[kind] = {
        totalCount: result.totalCount,
        fetchedCount: result.fetchedCount,
        complete: result.complete,
        stoppedByOffsetLimit: result.stoppedByOffsetLimit,
        source: "official-api",
      };
    }
  }
  const snapshot = {
    schemaVersion: 1,
    provider: "fanza",
    sourceType: inputPath ? "official-api-normalized-input" : "official-api",
    floorId,
    fetchedAt: new Date().toISOString(),
    catalogStatus: Object.values(coverage).every((item) => item.complete) ? "complete-floor-snapshot" : "partial-floor-snapshot",
    coverage,
    items,
  };
  if (hasFlag("--stdout")) console.log(JSON.stringify(snapshot, null, 2));
  else writeSnapshot(snapshot);
} catch (error) {
  console.error(`FANZA registry snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
