import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { resolvePrivateLibraryRoot, resolveReadableLibraryRoots } from "./lib/runtime-settings.mjs";

/**
 * 这是一个“不依赖 Next.js / TypeScript”的资料库健康检查脚本。
 *
 * 设计目的：即使依赖还没有安装，也可以先用 Node.js 检查 JSON 是否损坏、
 * 作品引用的人物/厂商/系列/Genre/Asset 是否真实存在。
 * 后续 V1.x 会把更多 schema 校验规则逐步加入这里。
 */
const libraryRoots = resolveReadableLibraryRoots();
const errors = [];

const collections = {
  works: await readCollection("works"),
  people: await readCollection("people"),
  organizations: await readCollection("organizations"),
  series: await readCollection("series"),
  genres: await readCollection("genres"),
  tags: await readCollection("tags"),
  assets: await readCollection("assets"),
  mediaFiles: await readPrivateCollection("media-files"),
};

const indexes = Object.fromEntries(
  Object.entries(collections).map(([name, items]) => [name, indexById(name, items)]),
);

validateWorks();
validatePeople();
validateAssets();
validateMediaFiles();

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

async function readCollection(name) {
  const merged = new Map();

  for (const root of libraryRoots) {
    const directory = path.join(root, name);
    let names;
    try {
      names = await readdir(directory);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      errors.push(`${name}: 无法读取目录 ${directory} (${error.message})`);
      continue;
    }

    for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
      try {
        const item = JSON.parse(await readFile(path.join(directory, fileName), "utf8"));
        if (!item?.id) {
          errors.push(`${name}/${fileName}: 缺少 id，无法参与分层资料合并`);
          continue;
        }
        if (!merged.has(item.id)) merged.set(item.id, item);
      } catch (error) {
        errors.push(`${name}/${fileName}: JSON 无法解析 (${error.message})`);
      }
    }
  }

  return [...merged.values()];
}

async function readPrivateCollection(name) {
  const root = resolvePrivateLibraryRoot();
  if (!root) return [];
  const directory = path.join(root, name);
  let names;
  try { names = await readdir(directory); }
  catch (error) {
    if (error?.code === "ENOENT") return [];
    errors.push(`${name}: 无法读取私人目录 ${directory} (${error.message})`);
    return [];
  }
  const items = [];
  for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
    try { items.push(JSON.parse(await readFile(path.join(directory, fileName), "utf8"))); }
    catch (error) { errors.push(`${name}/${fileName}: JSON 无法解析 (${error.message})`); }
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
    if (!primaryNames.some((name) => name.language === "ja")) {
      errors.push(`${prefix}: 至少需要一个日文 primary 姓名`);
    }

    if (person.heightCm !== undefined && person.heightCm <= 0) {
      errors.push(`${prefix}: heightCm 必须大于 0`);
    }

    if (person.portraitAssetId) {
      requireReference(prefix, "portrait asset", person.portraitAssetId, indexes.assets);
    }
    for (const id of person.galleryAssetIds ?? []) {
      requireReference(prefix, "gallery asset", id, indexes.assets);
    }
    for (const relation of person.organizationRelations ?? []) {
      requireReference(prefix, "organization", relation.organizationId, indexes.organizations);
    }
  }
}

function validateAssets() {
  for (const asset of collections.assets) {
    const prefix = `asset ${asset.id ?? "<unknown>"}`;
    if (!asset.storagePath || typeof asset.storagePath !== "string") {
      errors.push(`${prefix}: 缺少 storagePath`);
    }
    if ((asset.subjectType && !asset.subjectId) || (!asset.subjectType && asset.subjectId)) {
      errors.push(`${prefix}: subjectType / subjectId 必须同时存在或同时省略`);
    }
    if (asset.subjectType === "person") requireReference(prefix, "subject person", asset.subjectId, indexes.people);
    if (asset.subjectType === "work") requireReference(prefix, "subject work", asset.subjectId, indexes.works);
  }
}

function validateMediaFiles() {
  for (const media of collections.mediaFiles) {
    const prefix = `media-file ${media.id ?? "<unknown>"}`;
    if (!media.path || typeof media.path !== "string") errors.push(`${prefix}: 缺少 path`);
    if (!media.fileName || typeof media.fileName !== "string") errors.push(`${prefix}: 缺少 fileName`);
    if (media.workId) requireReference(prefix, "work", media.workId, indexes.works);
    if (media.fileSize !== undefined && media.fileSize < 0) errors.push(`${prefix}: fileSize 不能小于 0`);
    if (media.durationSeconds !== undefined && media.durationSeconds < 0) errors.push(`${prefix}: durationSeconds 不能小于 0`);
  }
}

function requireReference(owner, kind, id, index) {
  if (!id || !index.has(id)) {
    errors.push(`${owner}: ${kind} 引用不存在 (${id ?? "<empty>"})`);
  }
}
