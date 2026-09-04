import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * V1-24 Dev Fixture 自检。
 *
 * 它不读取用户的 .localogue/settings.json，也不依赖本机 Private Library。
 * 只验证 examples/dev-library/template：
 * - JSON 可解析、ID 唯一、核心引用有效；
 * - Asset 文件真实存在于 asset-files/；
 * - JPEG 签名、fileSize、SHA-256 与 Asset JSON 一致；
 * - 至少存在“有效偏好 / 默认回退 / stale 偏好 / 删除保护”测试场景；
 * - imports / settings / shared-packs 示例仍与同一 Fixture 对齐；
 * - 不允许重新引入旧 examples/people / examples/works 双份结构示例。
 */
const fixtureRoot = path.join(process.cwd(), "examples", "dev-library");
const libraryRoot = path.join(fixtureRoot, "template");
const manifestPath = path.join(fixtureRoot, "fixture-manifest.json");
const examplesRoot = path.join(process.cwd(), "examples");
const errors = [];

const manifest = await readJson(manifestPath, "fixture-manifest.json");
const existingWorkImport = await readJson(
  path.join(examplesRoot, "imports", "sample-existing-work.json"),
  "imports/sample-existing-work.json",
);
const settingsExample = await readJson(
  path.join(examplesRoot, "settings", "settings.example.json"),
  "settings/settings.example.json",
);
const sharedPackManifest = await readJson(
  path.join(examplesRoot, "shared-packs", "starter-community-pack", "localogue-pack.json"),
  "shared-packs/starter-community-pack/localogue-pack.json",
);
const collections = {
  works: await readCollection("works"),
  people: await readCollection("people"),
  organizations: await readCollection("organizations"),
  series: await readCollection("series"),
  genres: await readCollection("genres"),
  tags: await readCollection("tags"),
  assets: await readCollection("assets"),
  preferences: await readCollection("presentation-preferences"),
};
const indexes = Object.fromEntries(
  Object.entries(collections).map(([name, items]) => [name, indexById(name, items)]),
);

validateWorks();
validatePeople();
await validateAssets();
validatePreferences();
validateScenarioManifest();
await validateCompanionExamples();
await validateLegacyExampleLayout();

if (errors.length) {
  console.error("\nLocalogue Dev Fixture 校验失败：\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const stale = collections.preferences.filter((item) => preferredAssetId(item) && !indexes.assets.has(preferredAssetId(item))).length;
  console.log("Localogue Dev Fixture 校验通过。\n");
  console.table({
    works: collections.works.length,
    people: collections.people.length,
    assets: collections.assets.length,
    preferences: collections.preferences.length,
    stalePreferences: stale,
    generatedImages: collections.assets.length,
    companionExamples: 4,
  });
}

async function readCollection(name) {
  const directory = path.join(libraryRoot, name);
  let names = [];
  try { names = await readdir(directory); }
  catch (error) {
    errors.push(`${name}: 无法读取目录 (${error.message})`);
    return [];
  }
  const items = [];
  for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
    const item = await readJson(path.join(directory, fileName), `${name}/${fileName}`);
    if (item) items.push(item);
  }
  return items;
}

async function readJson(filePath, label) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) {
    errors.push(`${label}: JSON 无法解析 (${error.message})`);
    return null;
  }
}

function indexById(name, items) {
  const index = new Map();
  for (const item of items) {
    if (!item?.id || typeof item.id !== "string") {
      errors.push(`${name}: 记录缺少字符串 id`);
      continue;
    }
    if (index.has(item.id)) errors.push(`${name}: 重复 id ${item.id}`);
    index.set(item.id, item);
  }
  return index;
}

function validateWorks() {
  for (const work of collections.works) {
    const prefix = `work ${work.id}`;
    for (const relation of work.personRelations ?? []) requireRef(prefix, "person", relation.personId, indexes.people);
    if (work.makerId) requireRef(prefix, "maker", work.makerId, indexes.organizations);
    if (work.labelId) requireRef(prefix, "label", work.labelId, indexes.organizations);
    for (const id of work.seriesIds ?? []) requireRef(prefix, "series", id, indexes.series);
    for (const id of work.genreIds ?? []) requireRef(prefix, "genre", id, indexes.genres);
    for (const id of work.tagIds ?? []) requireRef(prefix, "tag", id, indexes.tags);
    for (const id of work.assetIds ?? []) requireRef(prefix, "asset", id, indexes.assets);
  }
}

function validatePeople() {
  for (const person of collections.people) {
    const prefix = `person ${person.id}`;
    if (!(person.names ?? []).some((item) => item.type === "primary" && item.language === "ja")) {
      errors.push(`${prefix}: 缺少日文 primary 姓名`);
    }
    if (person.portraitAssetId) requireRef(prefix, "portrait asset", person.portraitAssetId, indexes.assets);
    for (const id of person.galleryAssetIds ?? []) requireRef(prefix, "gallery asset", id, indexes.assets);
  }
}

async function validateAssets() {
  for (const asset of collections.assets) {
    const prefix = `asset ${asset.id}`;
    if (!asset.storagePath || path.isAbsolute(asset.storagePath) || asset.storagePath.split(/[\\/]+/).includes("..")) {
      errors.push(`${prefix}: storagePath 必须是安全相对路径`);
      continue;
    }
    if (!asset.storagePath.replaceAll("\\", "/").startsWith("asset-files/")) {
      errors.push(`${prefix}: storagePath 必须位于 asset-files/`);
      continue;
    }
    if (asset.subjectType === "work") requireRef(prefix, "subject work", asset.subjectId, indexes.works);
    if (asset.subjectType === "person") requireRef(prefix, "subject person", asset.subjectId, indexes.people);

    const filePath = path.join(libraryRoot, asset.storagePath);
    let fileInfo;
    let bytes;
    try {
      fileInfo = await stat(filePath);
      bytes = await readFile(filePath);
    } catch (error) {
      errors.push(`${prefix}: Asset 文件不存在 (${asset.storagePath}: ${error.message})`);
      continue;
    }
    if (!fileInfo.isFile()) errors.push(`${prefix}: storagePath 不是普通文件`);
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      errors.push(`${prefix}: 当前 Fixture 图片必须是真实 JPEG`);
    }
    if (asset.mimeType !== "image/jpeg") errors.push(`${prefix}: mimeType 应为 image/jpeg`);
    if (asset.fileSize !== bytes.length) errors.push(`${prefix}: fileSize 与真实文件不一致`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (asset.sha256 !== digest) errors.push(`${prefix}: SHA-256 与真实文件不一致`);
  }
}

function validatePreferences() {
  for (const preference of collections.preferences) {
    const prefix = `presentation ${preference.id}`;
    if (preference.schemaVersion !== 1) errors.push(`${prefix}: schemaVersion 必须是 1`);
    if (preference.entityType === "work") requireRef(prefix, "work", preference.entityId, indexes.works);
    else if (preference.entityType === "person") requireRef(prefix, "person", preference.entityId, indexes.people);
    else errors.push(`${prefix}: entityType 必须是 work / person`);
  }
}

function validateScenarioManifest() {
  if (!manifest?.scenarios) {
    errors.push("fixture-manifest.json: 缺少 scenarios");
    return;
  }
  const scenarios = manifest.scenarios;
  requireRef("manifest validWorkPreference", "work", scenarios.validWorkPreference?.entityId, indexes.works);
  requireRef("manifest validWorkPreference", "preferred asset", scenarios.validWorkPreference?.preferredAssetId, indexes.assets);
  requireRef("manifest validPersonPreference", "person", scenarios.validPersonPreference?.entityId, indexes.people);
  requireRef("manifest validPersonPreference", "preferred asset", scenarios.validPersonPreference?.preferredAssetId, indexes.assets);
  requireRef("manifest defaultWorkFallback", "work", scenarios.defaultWorkFallback?.entityId, indexes.works);
  requireRef("manifest defaultWorkFallback", "alternate asset", scenarios.defaultWorkFallback?.alternateAssetId, indexes.assets);
  requireRef("manifest defaultPersonFallback", "person", scenarios.defaultPersonFallback?.entityId, indexes.people);
  requireRef("manifest defaultPersonFallback", "alternate asset", scenarios.defaultPersonFallback?.alternateAssetId, indexes.assets);

  const staleId = scenarios.staleWorkPreference?.missingAssetId;
  if (!staleId) errors.push("manifest staleWorkPreference: 缺少 missingAssetId");
  else if (indexes.assets.has(staleId)) errors.push("manifest staleWorkPreference: missingAssetId 不应真实存在，否则无法测试 stale 状态");

  const validWorkPreference = collections.preferences.find((item) => item.entityId === scenarios.validWorkPreference?.entityId);
  if (validWorkPreference?.preferredCoverAssetId !== scenarios.validWorkPreference?.preferredAssetId) {
    errors.push("validWorkPreference: Preference 与 manifest 预期不一致");
  }
  const validPersonPreference = collections.preferences.find((item) => item.entityId === scenarios.validPersonPreference?.entityId);
  if (validPersonPreference?.preferredPortraitAssetId !== scenarios.validPersonPreference?.preferredAssetId) {
    errors.push("validPersonPreference: Preference 与 manifest 预期不一致");
  }
  const stalePreference = collections.preferences.find((item) => item.entityId === scenarios.staleWorkPreference?.entityId);
  if (stalePreference?.preferredCoverAssetId !== staleId) errors.push("staleWorkPreference: 没有构造预期的 stale Preference");
}


async function validateCompanionExamples() {
  const companions = manifest?.companions;
  if (!companions) {
    errors.push("fixture-manifest.json: 缺少 companions，Examples 联动关系未声明");
    return;
  }

  const expectedCompanions = {
    existingWorkImport: "examples/imports/sample-existing-work.json",
    newWorkImport: "examples/imports/sample-work.json",
    settingsExample: "examples/settings/settings.example.json",
    sharedPack: "examples/shared-packs/starter-community-pack",
  };
  for (const [key, value] of Object.entries(expectedCompanions)) {
    if (companions[key] !== value) errors.push(`fixture-manifest.json companions.${key}: 应为 ${value}`);
  }

  const targetWorkId = manifest?.scenarios?.validWorkPreference?.entityId;
  const targetWork = targetWorkId ? indexes.works.get(targetWorkId) : null;
  if (!targetWork) {
    errors.push("imports/sample-existing-work.json: 无法解析 manifest validWorkPreference 对应 Work");
  } else if (!existingWorkImport) {
    errors.push("imports/sample-existing-work.json: 文件不可用");
  } else {
    if (existingWorkImport.code !== targetWork.code) {
      errors.push(`imports/sample-existing-work.json: code 必须命中 Dev Fixture Work ${targetWork.code}`);
    }
    if (existingWorkImport.durationMinutes === targetWork.durationMinutes) {
      errors.push("imports/sample-existing-work.json: durationMinutes 必须故意与 Canonical 不同，否则无法稳定测试字段差异");
    }
  }

  if (!settingsExample) {
    errors.push("settings/settings.example.json: 文件不可用");
  } else {
    if (settingsExample.libraryPath !== "./var/dev-fixture-library") {
      errors.push("settings/settings.example.json: libraryPath 应指向 ./var/dev-fixture-library");
    }
    const sharedPath = "./examples/shared-packs/starter-community-pack";
    if (!Array.isArray(settingsExample.sharedPackPaths) || !settingsExample.sharedPackPaths.includes(sharedPath)) {
      errors.push(`settings/settings.example.json: sharedPackPaths 应包含 ${sharedPath}`);
    }
  }

  if (!sharedPackManifest) {
    errors.push("starter-community-pack: localogue-pack.json 不可用");
  } else if (sharedPackManifest.kind !== "shared-library") {
    errors.push("starter-community-pack: kind 必须是 shared-library");
  }

  const priorityScenario = manifest?.scenarios?.privateOverShared;
  const priorityEntityId = priorityScenario?.entityId;
  if (!priorityEntityId || !indexes.people.has(priorityEntityId)) {
    errors.push("privateOverShared: manifest 必须指向一个真实 Private Person");
    return;
  }

  const sharedPeopleRoot = path.join(examplesRoot, "shared-packs", "starter-community-pack", "library", "people");
  let sharedPeople = [];
  try {
    const fileNames = (await readdir(sharedPeopleRoot)).filter((item) => item.endsWith(".json"));
    sharedPeople = (await Promise.all(fileNames.map((fileName) => readJson(
      path.join(sharedPeopleRoot, fileName),
      `shared-packs/starter-community-pack/library/people/${fileName}`,
    )))).filter(Boolean);
  } catch (error) {
    errors.push(`starter-community-pack people: 无法读取目录 (${error.message})`);
    return;
  }

  const sharedRecord = sharedPeople.find((item) => item.id === priorityEntityId);
  if (!sharedRecord) {
    errors.push(`privateOverShared: Shared Pack 缺少同 ID 记录 ${priorityEntityId}`);
    return;
  }
  const privateRecord = indexes.people.get(priorityEntityId);
  const privatePrimary = primaryJaName(privateRecord);
  const sharedPrimary = primaryJaName(sharedRecord);
  if (privatePrimary !== priorityScenario.privatePrimaryName) {
    errors.push(`privateOverShared: Private primary name 应为 ${priorityScenario.privatePrimaryName}`);
  }
  if (sharedPrimary !== priorityScenario.sharedPrimaryName) {
    errors.push(`privateOverShared: Shared primary name 应为 ${priorityScenario.sharedPrimaryName}`);
  }
  if (privatePrimary === sharedPrimary) {
    errors.push("privateOverShared: Private / Shared 名称必须故意不同，否则 UI 无法肉眼验证优先级");
  }
}

async function validateLegacyExampleLayout() {
  for (const name of ["people", "works"]) {
    const legacyPath = path.join(examplesRoot, name);
    if (await exists(legacyPath)) {
      errors.push(`examples/${name}/: 旧的独立结构示例已并入 dev-library/template/${name}/，请删除该目录避免双份示例漂移`);
    }
  }
}

function primaryJaName(person) {
  return person?.names?.find((item) => item.language === "ja" && item.type === "primary")?.value ?? null;
}

async function exists(value) {
  try {
    await stat(value);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function preferredAssetId(preference) {
  return preference.preferredCoverAssetId ?? preference.preferredPortraitAssetId;
}

function requireRef(prefix, kind, id, index) {
  if (!id || !index.has(id)) errors.push(`${prefix}: ${kind} 不存在 (${id ?? "<empty>"})`);
}
