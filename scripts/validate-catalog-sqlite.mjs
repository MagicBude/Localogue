import { DatabaseSync } from "node:sqlite";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const databasePath = path.resolve(process.argv[2] ?? path.join(root, ".localogue", "catalog.db"));
const sourceRoot = path.resolve(process.argv[3] ?? path.join(root, "..", "localogue-community-data", "library"));
await access(databasePath);
const database = new DatabaseSync(databasePath, { readOnly: true });
const errors = [];
for (const collection of ["works", "people", "organizations", "series", "tags", "assets"]) {
  const expected = await jsonCount(path.join(sourceRoot, collection));
  const actual = Number(database.prepare(`SELECT count(*) AS count FROM ${collection}`).get().count);
  if (expected !== actual) errors.push(`${collection}: JSON ${expected} / SQLite ${actual}`);
}
for (const [table, file] of [
  ["genres", "genres.json"],
  ["work_type_definitions", "work-types.json"],
  ["source_only_classifications", "source-only-classifications.json"],
  ["classification_crosswalk", "community-classification-crosswalk.json"],
]) {
  const document = JSON.parse(await readFile(path.join(root, "resources", "vocabularies", file), "utf8"));
  const actual = Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count);
  if (document.items.length !== actual) errors.push(`${table}: JSON ${document.items.length} / SQLite ${actual}`);
}
const integrity = database.prepare("PRAGMA integrity_check").get().integrity_check;
const foreignKeys = database.prepare("PRAGMA foreign_key_check").all();
const version = database.prepare("PRAGMA user_version").get().user_version;
const unmappedRelations = Number(database.prepare("SELECT count(*) AS count FROM work_unmapped_classifications").get().count);
database.close();
if (integrity !== "ok") errors.push(`integrity_check: ${integrity}`);
if (foreignKeys.length) errors.push(`foreign_key_check: ${foreignKeys.length} 项`);
if (version !== 1) errors.push(`schema version: ${version}`);
if (unmappedRelations !== 0) errors.push(`仍有 ${unmappedRelations} 个 Community 分类关系没有进入 Crosswalk`);
if (errors.length) { console.error("Catalog SQLite 对账失败："); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log(`Catalog SQLite 对账通过：${databasePath}`);

async function jsonCount(directory) {
  try { return (await readdir(directory)).filter((name) => name.endsWith(".json")).length; }
  catch (error) { if (error?.code === "ENOENT") return 0; throw error; }
}
