import { DatabaseSync } from "node:sqlite";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const databasePath = path.resolve(process.argv[2] ?? path.join(root, ".localogue", "local.db"));
const sourceRoot = path.resolve(process.argv[3] ?? path.join(root, "data", "library"));
await access(databasePath);
const database = new DatabaseSync(databasePath, { readOnly: true });
const errors = [];
const expectedEntities = await sum(["works", "people", "organizations", "series", "genres", "tags", "assets"]);
const expectedMedia = await count("media-files");
const expectedPreferences = await count("presentation-preferences");
const expectedEvidence = await count("evidence");
const auditCollections = ["evidence-lifecycle", "review-commits", "snapshots", "restore-receipts", "provenance", "media-binding-receipts", "asset-deletion-receipts", "media-scan-history", "person-edit-receipts"];
const expectedAudit = await sum(auditCollections);
check("private_entities", expectedEntities);
check("media_files", expectedMedia);
check("presentation_preferences", expectedPreferences);
check("evidence", expectedEvidence);
check("audit_records", expectedAudit);
const receipt = database.prepare("SELECT * FROM migration_receipts ORDER BY id DESC LIMIT 1").get();
if (!receipt || Number(receipt.entity_count) !== expectedEntities || Number(receipt.audit_count) !== expectedAudit) errors.push("Migration Receipt 与来源计数不一致");
if (database.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") errors.push("SQLite integrity_check 未通过");
if (database.prepare("PRAGMA foreign_key_check").all().length) errors.push("SQLite foreign_key_check 未通过");
if (Number(database.prepare("PRAGMA user_version").get().user_version) !== 1) errors.push("local.db Schema 版本不正确");
database.close();
if (errors.length) { console.error("Local SQLite 对账失败："); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log(`Local SQLite 对账通过：实体 ${expectedEntities}、媒体 ${expectedMedia}、偏好 ${expectedPreferences}、Evidence ${expectedEvidence}、审计 ${expectedAudit}`);

function check(table, expected) {
  const actual = Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count);
  if (actual !== expected) errors.push(`${table}: JSON ${expected} / SQLite ${actual}`);
}
async function count(collection) {
  try { return (await readdir(path.join(sourceRoot, collection))).filter((name) => name.endsWith(".json")).length; }
  catch (error) { if (error?.code === "ENOENT") return 0; throw error; }
}
async function sum(collections) { let total = 0; for (const collection of collections) total += await count(collection); return total; }

