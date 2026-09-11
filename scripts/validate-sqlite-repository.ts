import { DatabaseSync } from "node:sqlite";
import { copyFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { SqliteLibraryRepository } from "../src/infrastructure/repositories/sqlite-library-repository";

/**
 * Repository Contract 冒烟检查。
 *
 * 测试先复制 local.db，再在副本里验证 Private Override，绝不修改用户的真实数据库。
 * 查询继续走正式 queryWorks/queryPeople，因此这里重点防止 SQLite 映射、合并优先级和查找接口漂移。
 */
async function main(): Promise<void> {
  const root = process.cwd();
  const catalogPath = path.resolve(process.argv[2] ?? path.join(root, ".localogue", "catalog.db"));
  const localPath = path.resolve(process.argv[3] ?? path.join(root, ".localogue", "local.db"));
  const testLocalPath = path.join(path.dirname(localPath), `local.repository-test-${process.pid}.db`);

  await copyFile(localPath, testLocalPath);
  const repository = new SqliteLibraryRepository(catalogPath, testLocalPath);

  try {
  const catalog = new DatabaseSync(catalogPath, { readOnly: true });
  const expectedWorks = Number((catalog.prepare("SELECT COUNT(*) AS count FROM works").get() as { count: number }).count);
  const expectedPeople = Number((catalog.prepare("SELECT COUNT(*) AS count FROM people").get() as { count: number }).count);
  catalog.close();

  const works = await repository.listWorks({ page: 1, pageSize: 100_000 });
  const people = await repository.listPeople({ page: 1, pageSize: 100_000 });
  assert(works.total >= expectedWorks, `作品数少于 catalog.db：${works.total} < ${expectedWorks}`);
  assert(people.total >= expectedPeople, `人物数少于 catalog.db：${people.total} < ${expectedPeople}`);

  const firstWork = works.items[0];
  assert(firstWork, "catalog.db 没有可用于 Contract 的作品");
  assert((await repository.findWorkById(firstWork.id))?.id === firstWork.id, "findWorkById 未返回同一作品");
  assert((await repository.findWorkByCode(firstWork.code.replace(/-/g, " ")))?.id === firstWork.id, "findWorkByCode 没有保持番号规范化语义");

  if (firstWork.genreIds[0]) {
    const filtered = await repository.listWorks({ genreIds: [firstWork.genreIds[0]], page: 1, pageSize: 100_000 });
    assert(filtered.items.every((work) => work.genreIds.includes(firstWork.genreIds[0]!)), "Genre 查询返回了不匹配作品");
  }

  const marker = `repository-contract-${process.pid}`;
  await repository.saveWork({ ...firstWork, titles: { ...firstWork.titles, en: marker } });
  assert((await repository.findWorkById(firstWork.id))?.titles.en === marker, "Private Override 没有覆盖只读 Catalog 实体");

  console.log(`SQLite Repository Contract 通过：Works ${works.total}，People ${people.total}，Private Override 可读写。`);
  } finally {
    repository.close();
    await rm(testLocalPath, { force: true });
    await rm(`${testLocalPath}-shm`, { force: true });
    await rm(`${testLocalPath}-wal`, { force: true });
  }
}

void main();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
