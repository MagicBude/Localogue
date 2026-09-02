import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface CommunityPackValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<"people" | "works" | "organizations" | "series" | "genres", number>;
}

/**
 * 与 MagicBude/localogue-community-data V0-01 的 validator 对齐。
 *
 * 只有正式 Community Data Pack 才启用严格 typed UUIDv4 / Source Record 规则；
 * 其他第三方 Shared Pack 仍可通过 V1-09 的普通 manifest 协议挂载。
 */
export async function validateCommunityPackRoot(root: string): Promise<CommunityPackValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts = { people: 0, works: 0, organizations: 0, series: 0, genres: 0 };
  const manifest = await readJson(path.join(root, "localogue-pack.json"), errors, "localogue-pack.json");
  if (!manifest) return result();
  if (manifest.schemaVersion !== 1) errors.push("localogue-pack.json: schemaVersion 必须为 1");
  if (manifest.kind !== "shared-library") errors.push("localogue-pack.json: kind 必须为 shared-library");
  for (const key of ["id", "name", "version"] as const) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim()) errors.push(`localogue-pack.json: 缺少 ${key}`);
  }

  const libraryRoot = path.join(root, "library");
  const collections = {
    people: await readCollection(libraryRoot, "people", errors),
    works: await readCollection(libraryRoot, "works", errors),
    organizations: await readCollection(libraryRoot, "organizations", errors),
    series: await readCollection(libraryRoot, "series", errors),
    genres: await readCollection(libraryRoot, "genres", errors),
  };
  counts.people = collections.people.length;
  counts.works = collections.works.length;
  counts.organizations = collections.organizations.length;
  counts.series = collections.series.length;
  counts.genres = collections.genres.length;
  const indexes = Object.fromEntries(Object.entries(collections).map(([name, items]) => [name, new Map(items.map((item) => [item.id, item]))])) as Record<string, Map<string, Record<string, unknown>>>;
  const allEntities = new Map<string, { collection: string; item: Record<string, unknown> }>();
  for (const [collection, items] of Object.entries(collections)) {
    for (const item of items) {
      if (allEntities.has(String(item.id))) errors.push(`跨 collection 重复 id: ${item.id}`);
      else allEntities.set(String(item.id), { collection, item });
    }
  }

  for (const person of collections.people) {
    requireUuidId(String(person.id ?? ""), "person", `person ${person.id}`, errors);
    if (person.schemaVersion !== 1) errors.push(`person ${person.id}: schemaVersion 必须为 1`);
    const names = Array.isArray(person.names) ? person.names as Array<Record<string, unknown>> : [];
    if (!names.some((name) => name.language === "ja" && name.type === "primary" && typeof name.value === "string" && name.value.trim())) {
      errors.push(`person ${person.id}: 至少需要一个日文 primary 姓名`);
    }
    if (person.portraitAssetId || (Array.isArray(person.galleryAssetIds) && person.galleryAssetIds.length)) {
      errors.push(`person ${person.id}: Community Data 当前不接受图片 Asset 引用`);
    }
  }

  for (const org of collections.organizations) {
    const kind = org.kind;
    if (kind !== "maker" && kind !== "label") errors.push(`organization ${org.id}: kind 必须为 maker 或 label`);
    requireUuidId(String(org.id ?? ""), kind === "label" ? "label" : "maker", `organization ${org.id}`, errors);
    if (org.parentOrganizationId && !indexes.organizations.has(String(org.parentOrganizationId))) {
      errors.push(`organization ${org.id}: parentOrganizationId 不存在 (${org.parentOrganizationId})`);
    }
  }
  for (const item of collections.series) requireUuidId(String(item.id ?? ""), "series", `series ${item.id}`, errors);
  for (const item of collections.genres) requireUuidId(String(item.id ?? ""), "genre", `genre ${item.id}`, errors);

  const codes = new Map<string, string>();
  for (const work of collections.works) {
    requireUuidId(String(work.id ?? ""), "work", `work ${work.id}`, errors);
    if (work.schemaVersion !== 1) errors.push(`work ${work.id}: schemaVersion 必须为 1`);
    if (work.originalLanguage !== "ja") warnings.push(`work ${work.id}: originalLanguage 不是 ja，请确认原始语言`);
    const titles = isObject(work.titles) ? work.titles : {};
    if (typeof titles.ja !== "string" || !titles.ja.trim()) errors.push(`work ${work.id}: 缺少 titles.ja 日文原题`);
    if (typeof work.code !== "string" || !work.code.trim()) errors.push(`work ${work.id}: 缺少 code`);
    else {
      const normalized = normalizeCode(work.code);
      const previous = codes.get(normalized);
      if (previous) errors.push(`work ${work.id}: 番号与 ${previous} 重复 (${work.code})`);
      else codes.set(normalized, String(work.id));
    }
    for (const relation of Array.isArray(work.personRelations) ? work.personRelations as Array<Record<string, unknown>> : []) {
      requireRef(String(work.id), "person", relation.personId, indexes.people, errors);
    }
    if (work.makerId) requireRef(String(work.id), "maker", work.makerId, indexes.organizations, errors);
    if (work.labelId) requireRef(String(work.id), "label", work.labelId, indexes.organizations, errors);
    for (const id of asArray(work.seriesIds)) requireRef(String(work.id), "series", id, indexes.series, errors);
    for (const id of asArray(work.genreIds)) requireRef(String(work.id), "genre", id, indexes.genres, errors);
    if (asArray(work.tagIds).length) errors.push(`work ${work.id}: Community Work 不应包含用户 Tag`);
    if (asArray(work.assetIds).length) errors.push(`work ${work.id}: Community Data 当前不接受图片 Asset 引用`);
    if (asArray(work.mediaFileIds).length) errors.push(`work ${work.id}: Community Work 不得包含私人 MediaFile 引用`);
  }

  await validateSources(root, allEntities, errors);
  await validateForbidden(root, errors);
  return result();

  function result(): CommunityPackValidationResult {
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      counts,
    };
  }
}

async function readCollection(root: string, name: string, errors: string[]): Promise<Array<Record<string, unknown>>> {
  const directory = path.join(root, name);
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) { if (isMissing(error)) return []; throw error; }
  const items: Array<Record<string, unknown>> = [];
  const ids = new Set<string>();
  for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
    const item = await readJson(path.join(directory, fileName), errors, `${name}/${fileName}`);
    if (!item) continue;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) { errors.push(`${name}/${fileName}: 缺少字符串 id`); continue; }
    if (`${id}.json` !== fileName) errors.push(`${name}/${fileName}: 文件名必须与 id 完全一致`);
    if (ids.has(id)) errors.push(`${name}: 重复 id ${id}`);
    ids.add(id); items.push(item);
  }
  return items;
}

async function validateSources(root: string, allEntities: Map<string, { collection: string }>, errors: string[]) {
  const directory = path.join(root, "sources");
  let names: string[] = [];
  try { names = await readdir(directory); } catch (error) { if (!isMissing(error)) throw error; }
  const records = new Set<string>();
  for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
    const record = await readJson(path.join(directory, fileName), errors, `sources/${fileName}`);
    if (!record) continue;
    const entityId = typeof record.entityId === "string" ? record.entityId : "";
    if (!entityId || `${entityId}.json` !== fileName) errors.push(`sources/${fileName}: 文件名必须等于 entityId`);
    if (!allEntities.has(entityId)) errors.push(`sources/${fileName}: entityId 不存在于 library (${entityId})`);
    const sources = Array.isArray(record.sources) ? record.sources as Array<Record<string, unknown>> : [];
    if (!sources.length) errors.push(`sources/${fileName}: 至少需要一个 source`);
    for (const [index, source] of sources.entries()) {
      if (typeof source.url !== "string" || !source.url.trim()) errors.push(`sources/${fileName}: sources[${index}] 缺少 url`);
      if (typeof source.accessedAt !== "string" || !source.accessedAt.trim()) errors.push(`sources/${fileName}: sources[${index}] 缺少 accessedAt`);
      if (!Array.isArray(source.fields) || !source.fields.length) errors.push(`sources/${fileName}: sources[${index}] fields 不能为空`);
    }
    records.add(entityId);
  }
  for (const [id, info] of allEntities) {
    if (["people", "works", "organizations", "series"].includes(info.collection) && !records.has(id)) {
      errors.push(`${info.collection}/${id}: 缺少 sources/${id}.json`);
    }
  }
}

async function validateForbidden(root: string, errors: string[]) {
  const libraryRoot = path.join(root, "library");
  for (const name of ["media-files", "presentation-preferences", "person-edits", "evidence", "review-commits", "tags", "assets"]) {
    const directory = path.join(libraryRoot, name);
    try {
      const info = await stat(directory);
      if (!info.isDirectory()) continue;
      const names = await readdir(directory);
      if (names.some((item: string) => item.endsWith(".json"))) errors.push(`library/${name}: Community Data 不允许包含该类私人或未授权共享数据`);
    } catch (error) { if (!isMissing(error)) throw error; }
  }
}

async function readJson(filePath: string, errors: string[], label: string): Promise<Record<string, unknown> | null> {
  try { const value = JSON.parse(await readFile(filePath, "utf8")); return isObject(value) ? value : null; }
  catch (error) { errors.push(`${label}: JSON 无法解析或文件不可读 (${message(error)})`); return null; }
}

function requireUuidId(id: string, prefix: string, owner: string, errors: string[]) {
  const pattern = new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i");
  if (!pattern.test(id)) errors.push(`${owner}: id 必须使用 ${prefix}_<UUIDv4>`);
}
function requireRef(ownerId: string, kind: string, value: unknown, index: Map<string, unknown>, errors: string[]) {
  const id = typeof value === "string" ? value : "";
  if (!id || !index.has(id)) errors.push(`work ${ownerId}: ${kind} 引用不存在 (${id || "<empty>"})`);
}
function asArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function normalizeCode(value: string): string { return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
