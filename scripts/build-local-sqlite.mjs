import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * 将现有 Private Library JSON 复制迁移到 local.db。
 *
 * 此脚本只读来源目录，先构建临时数据库并提交 Migration Receipt，成功后才替换输出。
 * 原 JSON 和 asset-files / 视频文件永远不会被删除或移动。
 */
const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const sourceRoot = path.resolve(args.source ?? path.join(root, "data", "library"));
const output = path.resolve(args.output ?? path.join(root, ".localogue", "local.db"));
if (samePath(sourceRoot, output) || output.startsWith(`${sourceRoot}${path.sep}`)) throw new Error("local.db 输出不能位于 Private Library 来源目录内，避免备份边界混淆。");
const temporary = `${output}.tmp`;
const schema = await readFile(path.join(root, "resources", "sqlite", "local-schema.sql"), "utf8");
const canonicalCollections = ["works", "people", "organizations", "series", "genres", "tags", "assets"];
const auditCollections = ["evidence-lifecycle", "review-commits", "snapshots", "restore-receipts", "provenance", "media-binding-receipts", "asset-deletion-receipts", "media-scan-history", "person-edit-receipts"];

await mkdir(path.dirname(output), { recursive: true });
await rm(temporary, { force: true });
const database = new DatabaseSync(temporary);
const digest = createHash("sha256");
const counts = { entities: 0, media: 0, preferences: 0, evidence: 0, audit: 0 };
try {
  database.exec(schema);
  database.exec("BEGIN IMMEDIATE");
  putMeta(database, "schema_version", "1");
  putMeta(database, "source_path", sourceRoot);
  putMeta(database, "migrated_at", new Date().toISOString());

  for (const collection of canonicalCollections) {
    for (const entity of await readCollection(collection)) {
      const json = stableJson(entity);
      database.prepare("INSERT INTO private_entities VALUES (?, ?, ?, ?, ?)").run(collection, requireId(entity, collection), displayKey(collection, entity), entity.updatedAt ?? null, json);
      recordDigest(collection, entity.id, json);
      counts.entities += 1;
    }
  }
  for (const entity of await readCollection("media-files")) {
    const json = stableJson(entity);
    database.prepare("INSERT INTO media_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(requireId(entity, "media-files"), entity.path, entity.fileName, entity.workId ?? null, entity.scanRoot ?? null, entity.matchMethod ?? null, entity.fileModifiedAt ?? entity.updatedAt ?? null, json);
    recordDigest("media-files", entity.id, json);
    counts.media += 1;
  }
  for (const entity of await readCollection("presentation-preferences")) {
    const json = stableJson(entity);
    database.prepare("INSERT INTO presentation_preferences VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(requireId(entity, "presentation-preferences"), entity.entityType, entity.entityId, booleanInt(entity.favorite), entity.rating ?? null, entity.preferredCoverAssetId ?? entity.preferredPortraitAssetId ?? null, entity.updatedAt, json);
    recordDigest("presentation-preferences", entity.id, json);
    counts.preferences += 1;
  }
  for (const entity of await readCollection("evidence")) {
    const json = stableJson(entity);
    database.prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?)").run(requireId(entity, "evidence"), entity.sourceType, entity.sourceName, entity.importedAt, entity.normalized?.code ?? entity.raw?.code ?? null, json);
    recordDigest("evidence", entity.id, json);
    counts.evidence += 1;
  }
  for (const collection of auditCollections) {
    for (const entity of await readCollection(collection)) {
      const json = stableJson(entity);
      database.prepare("INSERT INTO audit_records VALUES (?, ?, ?, ?, ?)").run(collection, requireId(entity, collection), subjectId(entity), occurredAt(entity), json);
      recordDigest(collection, entity.id, json);
      counts.audit += 1;
    }
  }
  const migratedAt = new Date().toISOString();
  const sourceDigest = digest.digest("hex");
  database.prepare("INSERT INTO migration_receipts (migrated_at, source_path, source_digest, entity_count, media_count, preference_count, evidence_count, audit_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(migratedAt, sourceRoot, sourceDigest, counts.entities, counts.media, counts.preferences, counts.evidence, counts.audit);
  putMeta(database, "source_digest", sourceDigest);
  database.exec("COMMIT");
  database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  database.close();
  await rm(output, { force: true });
  await rename(temporary, output);
  console.log(JSON.stringify({ output, sourceRoot, sourceDigest, counts }, null, 2));
} catch (error) {
  try { database.exec("ROLLBACK"); } catch {}
  database.close();
  await rm(temporary, { force: true });
  throw error;
}

async function readCollection(collection) {
  const directory = path.join(sourceRoot, collection);
  try {
    const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    return Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(directory, name), "utf8"))));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function requireId(entity, collection) {
  if (typeof entity?.id !== "string" || !entity.id.trim()) throw new Error(`${collection} 存在缺少 id 的实体。`);
  return entity.id;
}

function displayKey(collection, entity) {
  if (collection === "works") return entity.code ?? entity.id;
  if (collection === "people") return entity.names?.find((name) => name.type === "primary")?.value ?? entity.names?.[0]?.value ?? entity.id;
  if (collection === "assets") return entity.storagePath ?? entity.id;
  return entity.names?.["zh-CN"] ?? entity.names?.ja ?? entity.names?.en ?? entity.id;
}

function subjectId(entity) { return entity.workId ?? entity.targetWorkId ?? entity.personId ?? entity.subjectId ?? entity.evidenceId ?? entity.mediaFileId ?? null; }
function occurredAt(entity) { return entity.updatedAt ?? entity.createdAt ?? entity.committedAt ?? entity.restoredAt ?? entity.changedAt ?? entity.recordedAt ?? null; }
function booleanInt(value) { return value === true ? 1 : value === false ? 0 : null; }
function stableJson(value) { return JSON.stringify(value); }
function recordDigest(collection, id, json) { digest.update(collection).update("\0").update(String(id)).update("\0").update(json).update("\n"); }
function putMeta(db, key, value) { db.prepare("INSERT INTO local_meta VALUES (?, ?)").run(key, value); }
function samePath(left, right) { return path.resolve(left).toLocaleLowerCase("en-US") === path.resolve(right).toLocaleLowerCase("en-US"); }

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--source") result.source = values[++index];
    else if (values[index] === "--output") result.output = values[++index];
    else throw new Error(`未知参数：${values[index]}`);
  }
  return result;
}

