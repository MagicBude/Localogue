import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * 将可审查的 Shared Pack JSON 构建为只读发布用 catalog.db。
 *
 * SQLite 是 JSON 的运行时投影，不改变 Domain ID，也不反向覆盖来源仓库。
 * 构建始终写临时文件，全部实体和关系成功后才原子替换正式数据库。
 */
const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const siblingCommunity = path.resolve(root, "..", "localogue-community-data");
const sourceRoot = path.resolve(args.source ?? siblingCommunity);
const libraryRoot = path.join(sourceRoot, "library");
const output = path.resolve(args.output ?? path.join(root, ".localogue", "catalog.db"));
const temporary = `${output}.tmp`;
const schema = await readFile(path.join(root, "resources", "sqlite", "catalog-schema.sql"), "utf8");
const manifest = await readOptionalJson(path.join(sourceRoot, "localogue-pack.json"));
const canonicalGenres = JSON.parse(await readFile(path.join(root, "resources", "vocabularies", "genres.json"), "utf8"));
const canonicalWorkTypes = JSON.parse(await readFile(path.join(root, "resources", "vocabularies", "work-types.json"), "utf8"));
const sourceOnly = JSON.parse(await readFile(path.join(root, "resources", "vocabularies", "source-only-classifications.json"), "utf8"));
const crosswalkDocument = JSON.parse(await readFile(path.join(root, "resources", "vocabularies", "community-classification-crosswalk.json"), "utf8"));
const classificationCrosswalk = new Map(crosswalkDocument.items.map((item) => [item.communityId, item.target]));

await mkdir(path.dirname(output), { recursive: true });
await rm(temporary, { force: true });
const database = new DatabaseSync(temporary);
try {
  database.exec(schema);
  database.exec("BEGIN IMMEDIATE");
  insertMeta(database, "schema_version", "1");
  insertMeta(database, "built_at", new Date().toISOString());
  insertMeta(database, "source_path", sourceRoot);
  if (manifest) {
    for (const key of ["id", "name", "version", "license", "updatedAt"]) {
      if (manifest[key] !== undefined) insertMeta(database, `pack_${snake(key)}`, String(manifest[key]));
    }
  }

  const counts = {};
  insertControlledVocabularies(database);
  counts.genres = canonicalGenres.items.length;
  counts.workTypeDefinitions = canonicalWorkTypes.items.length;
  counts.sourceOnlyClassifications = sourceOnly.items.length;
  counts.classificationCrosswalk = crosswalkDocument.items.length;
  for (const collection of ["works", "people", "organizations", "series", "tags", "assets"]) {
    const entities = await readCollection(libraryRoot, collection);
    counts[collection] = entities.length;
    for (const entity of entities) insertEntity(database, collection, entity);
  }
  database.exec("COMMIT");
  database.exec("PRAGMA optimize");
  database.close();
  await rm(output, { force: true });
  await rename(temporary, output);
  console.log(JSON.stringify({ output, sourceRoot, counts }, null, 2));
} catch (error) {
  try { database.exec("ROLLBACK"); } catch {}
  database.close();
  await rm(temporary, { force: true });
  throw error;
}

function insertEntity(db, collection, entity) {
  const json = JSON.stringify(entity);
  if (collection === "works") {
    db.prepare("INSERT INTO works VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(entity.id, entity.code, entity.originalLanguage ?? null, entity.titles?.ja ?? null, entity.titles?.["zh-CN"] ?? null, entity.titles?.en ?? null, entity.releaseDate?.value ?? null, entity.makerId ?? null, entity.labelId ?? null, json);
    insertLocalizedObject(db, "work", entity.id, entity.titles, "title");
    for (const relation of entity.personRelations ?? []) db.prepare("INSERT INTO work_people VALUES (?, ?, ?, ?)").run(entity.id, relation.personId, relation.role, relation.billingOrder ?? null);
    insertLinks(db, "work_tags", "tag_id", entity.id, entity.tagIds);
    insertLinks(db, "work_types", "work_type_id", entity.id, entity.workTypeIds);
    insertLinks(db, "work_series", "series_id", entity.id, entity.seriesIds);
    for (const sourceId of entity.genreIds ?? []) {
      const target = classificationCrosswalk.get(sourceId);
      if (target?.kind === "genre") db.prepare("INSERT OR IGNORE INTO work_genres VALUES (?, ?)").run(entity.id, target.id);
      else if (target?.kind === "workType") db.prepare("INSERT OR IGNORE INTO work_types VALUES (?, ?)").run(entity.id, target.id);
      else if (target?.kind === "sourceOnly") db.prepare("INSERT OR IGNORE INTO work_source_classifications VALUES (?, ?)").run(entity.id, target.id);
      else db.prepare("INSERT OR IGNORE INTO work_unmapped_classifications VALUES (?, ?)").run(entity.id, sourceId);
    }
    // catalog.db 的 JSON payload 也必须是规范化后的 Domain Work，确保 Web 与 Tauri
    // 读取同一投影，而不要求每个 Adapter 再解释旧 Community 混合分类。
    const normalizedGenreIds = db.prepare("SELECT genre_id AS id FROM work_genres WHERE work_id = ? ORDER BY genre_id").all(entity.id).map((row) => row.id);
    const normalizedWorkTypeIds = db.prepare("SELECT work_type_id AS id FROM work_types WHERE work_id = ? ORDER BY work_type_id").all(entity.id).map((row) => row.id);
    db.prepare("UPDATE works SET json = ? WHERE id = ?").run(JSON.stringify({ ...entity, genreIds: normalizedGenreIds, workTypeIds: normalizedWorkTypeIds }), entity.id);
  } else if (collection === "people") {
    const primary = (entity.names ?? []).find((name) => name.type === "primary")?.value ?? entity.names?.[0]?.value ?? null;
    db.prepare("INSERT INTO people VALUES (?, ?, ?, ?, ?)").run(entity.id, primary, entity.activityStatus ?? null, entity.birthDate?.value ?? null, json);
    for (let index = 0; index < (entity.names ?? []).length; index += 1) {
      const name = entity.names[index];
      insertName(db, "person", entity.id, name.language, name.type ?? "alias", name.value, index);
    }
  } else if (collection === "organizations") {
    db.prepare("INSERT INTO organizations VALUES (?, ?, ?, ?, ?, ?, ?)").run(entity.id, entity.kind, entity.names?.ja ?? null, entity.names?.["zh-CN"] ?? null, entity.names?.en ?? null, entity.parentOrganizationId ?? null, json);
    insertLocalizedObject(db, "organization", entity.id, entity.names, "primary");
    insertAliases(db, "organization", entity.id, entity.aliases);
    insertExternalIds(db, "organization", entity.id, entity.externalIds);
  } else if (collection === "series") {
    db.prepare("INSERT INTO series VALUES (?, ?, ?, ?, ?, ?, ?)").run(entity.id, entity.names?.ja ?? null, entity.names?.["zh-CN"] ?? null, entity.names?.en ?? null, entity.makerId ?? null, entity.labelId ?? null, json);
    insertLocalizedObject(db, "series", entity.id, entity.names, "primary");
    insertAliases(db, "series", entity.id, entity.aliases);
    insertExternalIds(db, "series", entity.id, entity.externalIds);
  } else if (collection === "genres") {
    db.prepare("INSERT INTO genres VALUES (?, ?, ?, ?, ?, ?, ?)").run(entity.id, entity.facet ?? null, entity.names?.ja ?? null, entity.names?.["zh-CN"] ?? null, entity.names?.en ?? null, entity.status ?? null, json);
    insertLocalizedObject(db, "genre", entity.id, entity.names, "primary");
    insertAliases(db, "genre", entity.id, entity.aliases);
  } else if (collection === "tags") {
    db.prepare("INSERT INTO tags VALUES (?, ?, ?, ?, ?)").run(entity.id, entity.names?.ja ?? null, entity.names?.["zh-CN"] ?? null, entity.names?.en ?? null, json);
    insertLocalizedObject(db, "tag", entity.id, entity.names, "primary");
    insertAliases(db, "tag", entity.id, entity.aliases);
  } else if (collection === "assets") {
    db.prepare("INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?)").run(entity.id, entity.type ?? null, entity.subjectType ?? null, entity.subjectId ?? null, entity.storagePath ?? null, json);
  }
}

function insertControlledVocabularies(db) {
  const genreStatement = db.prepare("INSERT INTO genres VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const item of canonicalGenres.items) {
    genreStatement.run(item.id, item.facets?.[0] ?? null, item.ja, item["zh-CN"], item.en, "active", JSON.stringify({ id: item.id, names: { ja: item.ja, "zh-CN": item["zh-CN"], en: item.en } }));
    for (const language of ["ja", "zh-CN", "en"]) insertName(db, "genre", item.id, language, "primary", item[language], 0);
  }
  const workTypeStatement = db.prepare("INSERT INTO work_type_definitions VALUES (?, ?, ?, ?, ?)");
  for (const item of canonicalWorkTypes.items) {
    workTypeStatement.run(item.id, item.ja, item["zh-CN"], item.en, JSON.stringify(item));
    for (const language of ["ja", "zh-CN", "en"]) insertName(db, "workType", item.id, language, "primary", item[language], 0);
  }
  const sourceOnlyStatement = db.prepare("INSERT INTO source_only_classifications VALUES (?, ?, ?, ?, ?, ?)");
  for (const item of sourceOnly.items) {
    sourceOnlyStatement.run(item.id, item.category, item.ja, item["zh-CN"], item.en, JSON.stringify(item));
    for (const language of ["ja", "zh-CN", "en"]) insertName(db, "sourceOnly", item.id, language, "primary", item[language], 0);
  }
  const crosswalkStatement = db.prepare("INSERT INTO classification_crosswalk VALUES (?, ?, ?, ?, ?)");
  for (const item of crosswalkDocument.items) crosswalkStatement.run(item.communityId, item.target.kind, item.target.id, item.decision, JSON.stringify(item));
}

function insertLinks(db, table, targetColumn, workId, values = []) {
  const statement = db.prepare(`INSERT INTO ${table} (work_id, ${targetColumn}) VALUES (?, ?)`);
  for (const value of values) statement.run(workId, value);
}

function insertLocalizedObject(db, type, id, values = {}, kind) {
  for (const language of ["ja", "zh-CN", "en"]) if (values?.[language]) insertName(db, type, id, language, kind, values[language], 0);
}

function insertAliases(db, type, id, aliases = {}) {
  for (const language of ["ja", "zh-CN", "en"]) for (const [index, value] of (aliases?.[language] ?? []).entries()) insertName(db, type, id, language, "alias", value, index);
}

function insertName(db, type, id, language, kind, value, order) {
  db.prepare("INSERT OR IGNORE INTO localized_names VALUES (?, ?, ?, ?, ?, ?)").run(type, id, language, kind, value, order);
}

function insertExternalIds(db, type, id, externalIds = {}) {
  const statement = db.prepare("INSERT INTO provider_entities VALUES (?, ?, ?, ?)");
  for (const [provider, providerId] of Object.entries(externalIds)) statement.run(type, id, provider, String(providerId));
}

function insertMeta(db, key, value) {
  db.prepare("INSERT INTO catalog_meta VALUES (?, ?)").run(key, value);
}

async function readCollection(rootPath, collection) {
  const directory = path.join(rootPath, collection);
  try {
    const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    return Promise.all(names.map(async (name) => JSON.parse(await readFile(path.join(directory, name), "utf8"))));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readOptionalJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--source") result.source = values[++index];
    else if (values[index] === "--output") result.output = values[++index];
    else throw new Error(`未知参数：${values[index]}`);
  }
  return result;
}

function snake(value) { return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`); }
