import { DatabaseSync } from "node:sqlite";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/** 将 local.db 导出回“一实体一 JSON”，用于人工检查、Portable Pack 和灾难恢复。 */
const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const databasePath = path.resolve(args.database ?? path.join(root, ".localogue", "local.db"));
const output = path.resolve(args.output ?? path.join(root, "var", "local-sqlite-export"));
const temporary = `${output}.tmp`;
const database = new DatabaseSync(databasePath, { readOnly: true });
await rm(temporary, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });
let exported = 0;
try {
  for (const row of database.prepare("SELECT collection, id, json FROM private_entities ORDER BY collection, id").all()) exported += await writeEntity(row.collection, row.id, row.json);
  for (const [table, collection] of [["media_files", "media-files"], ["presentation_preferences", "presentation-preferences"], ["evidence", "evidence"]]) {
    for (const row of database.prepare(`SELECT id, json FROM ${table} ORDER BY id`).all()) exported += await writeEntity(collection, row.id, row.json);
  }
  for (const row of database.prepare("SELECT collection, id, json FROM audit_records ORDER BY collection, id").all()) exported += await writeEntity(row.collection, row.id, row.json);
  database.close();
  await rm(output, { recursive: true, force: true });
  await rename(temporary, output);
  console.log(`Local SQLite 已导出 ${exported} 个 JSON：${output}`);
} catch (error) {
  database.close();
  await rm(temporary, { recursive: true, force: true });
  throw error;
}

async function writeEntity(collection, id, rawJson) {
  if (!/^[a-z0-9_-]+$/iu.test(collection) || !/^[a-z0-9_.-]+$/iu.test(id)) throw new Error(`数据库包含不安全的导出路径：${collection}/${id}`);
  const directory = path.join(temporary, collection);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.json`), `${JSON.stringify(JSON.parse(rawJson), null, 2)}\n`, "utf8");
  return 1;
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--database") result.database = values[++index];
    else if (values[index] === "--output") result.output = values[++index];
    else throw new Error(`未知参数：${values[index]}`);
  }
  return result;
}

