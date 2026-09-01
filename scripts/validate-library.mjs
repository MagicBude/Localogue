import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Next.js 会自动读取 .env.local，但独立 Node 脚本不会。
// Node 22 提供 loadEnvFile，可让 validate:data 与网页使用同一个资料库路径。
if (!process.env.LOCALOGUE_LIBRARY_PATH) {
  try {
    process.loadEnvFile(path.join(process.cwd(), ".env.local"));
  } catch {
    // 没有 .env.local 时继续使用 Demo Library，这是正常的首次运行状态。
  }
}

/**
 * 这是一个“不依赖 Next.js / TypeScript”的资料库健康检查脚本。
 *
 * 设计目的：即使依赖还没有安装，也可以先用 Node.js 检查 JSON 是否损坏、
 * 作品引用的人物/厂商/系列/Genre/Asset 是否真实存在。
 * 后续 V1.x 会把更多 schema 校验规则逐步加入这里。
 */
const libraryRoot = resolveLibraryRoot();
const errors = [];

const collections = {
  works: await readCollection("works"),
  people: await readCollection("people"),
  organizations: await readCollection("organizations"),
  series: await readCollection("series"),
  genres: await readCollection("genres"),
  tags: await readCollection("tags"),
  assets: await readCollection("assets"),
};

const indexes = Object.fromEntries(
  Object.entries(collections).map(([name, items]) => [name, indexById(name, items)]),
);

validateWorks();
validatePeople();

if (errors.length > 0) {
  console.error("\nLocalogue 资料库校验失败：\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Localogue 资料库校验通过。\n");
  console.table(
    Object.fromEntries(
      Object.entries(collections).map(([name, items]) => [name, items.length]),
    ),
  );
}

function resolveLibraryRoot() {
  const configured = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  return configured
    ? path.resolve(process.cwd(), configured)
    : path.join(process.cwd(), "data", "demo-library");
}

async function readCollection(name) {
  const directory = path.join(libraryRoot, name);
  let names;

  try {
    names = await readdir(directory);
  } catch (error) {
    errors.push(`${name}: 无法读取目录 ${directory} (${error.message})`);
    return [];
  }

  const items = [];
  for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
    const filePath = path.join(directory, fileName);
    try {
      const raw = await readFile(filePath, "utf8");
      items.push(JSON.parse(raw));
    } catch (error) {
      errors.push(`${name}/${fileName}: JSON 无法解析 (${error.message})`);
    }
  }

  return items;
}

function indexById(collectionName, items) {
  const index = new Map();
  for (const item of items) {
    if (!item?.id || typeof item.id !== "string") {
      errors.push(`${collectionName}: 发现缺少字符串 id 的记录`);
      continue;
    }
    if (index.has(item.id)) {
      errors.push(`${collectionName}: 重复 id ${item.id}`);
    }
    index.set(item.id, item);
  }
  return index;
}

function validateWorks() {
  const codes = new Set();

  for (const work of collections.works) {
    const prefix = `work ${work.id ?? "<unknown>"}`;

    if (!work.code || typeof work.code !== "string") {
      errors.push(`${prefix}: 缺少 code`);
    } else {
      const normalizedCode = work.code.toUpperCase();
      if (codes.has(normalizedCode)) {
        errors.push(`${prefix}: 番号重复 ${work.code}`);
      }
      codes.add(normalizedCode);
    }

    if (work.durationMinutes !== undefined && work.durationMinutes < 0) {
      errors.push(`${prefix}: durationMinutes 不能小于 0`);
    }

    for (const relation of work.personRelations ?? []) {
      requireReference(prefix, "person", relation.personId, indexes.people);
    }

    if (work.makerId) {
      requireReference(prefix, "maker", work.makerId, indexes.organizations);
    }
    if (work.labelId) {
      requireReference(prefix, "label", work.labelId, indexes.organizations);
    }

    for (const id of work.seriesIds ?? []) {
      requireReference(prefix, "series", id, indexes.series);
    }
    for (const id of work.genreIds ?? []) {
      requireReference(prefix, "genre", id, indexes.genres);
    }
    for (const id of work.tagIds ?? []) {
      requireReference(prefix, "tag", id, indexes.tags);
    }
    for (const id of work.assetIds ?? []) {
      requireReference(prefix, "asset", id, indexes.assets);
    }
  }
}

function validatePeople() {
  for (const person of collections.people) {
    const prefix = `person ${person.id ?? "<unknown>"}`;
    const primaryNames = (person.names ?? []).filter((name) => name.type === "primary");

    if (primaryNames.length === 0) {
      errors.push(`${prefix}: 至少需要一个 primary 姓名`);
    }

    if (person.heightCm !== undefined && person.heightCm <= 0) {
      errors.push(`${prefix}: heightCm 必须大于 0`);
    }

    if (person.portraitAssetId) {
      requireReference(prefix, "portrait asset", person.portraitAssetId, indexes.assets);
    }
  }
}

function requireReference(owner, kind, id, index) {
  if (!id || !index.has(id)) {
    errors.push(`${owner}: ${kind} 引用不存在 (${id ?? "<empty>"})`);
  }
}
