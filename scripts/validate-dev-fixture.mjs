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
const desktopSettingsExample = await readJson(
  path.join(examplesRoot, "settings", "desktop-settings.example.json"),
  "settings/desktop-settings.example.json",
);
const instanceSettingsSchema = await readJson(
  path.join(process.cwd(), "schemas", "instance-settings.schema.json"),
  "schemas/instance-settings.schema.json",
);
const sharedPackManifest = await readJson(
  path.join(examplesRoot, "shared-packs", "starter-community-pack", "localogue-pack.json"),
  "shared-packs/starter-community-pack/localogue-pack.json",
);
const legacyJsonImport = await readJson(
  path.join(examplesRoot, "imports", "sample-demo-work.json"),
  "imports/sample-demo-work.json",
);
const legacyNfoImport = await readFile(
  path.join(examplesRoot, "imports", "sample-demo-work.nfo"),
  "utf8",
).catch((error) => {
  errors.push(`imports/sample-demo-work.nfo: 无法读取 (${error.message})`);
  return "";
});
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
validateFixtureCoverage();
await validateLegacyDemoParity();
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
    companionExamples: 7,
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

function validateFixtureCoverage() {
  const coverage = manifest?.coverage;
  if (!coverage) {
    errors.push("fixture-manifest.json: 缺少 coverage，无法约束示例库最小展示规模");
    return;
  }
  if (collections.works.length < (coverage.minimumWorks ?? 0)) {
    errors.push(`Fixture Work 过少：${collections.works.length} < ${coverage.minimumWorks}`);
  }
  if (collections.people.length < (coverage.minimumPeople ?? 0)) {
    errors.push(`Fixture Person 过少：${collections.people.length} < ${coverage.minimumPeople}`);
  }
  if (collections.assets.length < (coverage.minimumAssets ?? 0)) {
    errors.push(`Fixture Asset 过少：${collections.assets.length} < ${coverage.minimumAssets}`);
  }

  const visualWorks = new Set(coverage.visualWorks ?? []);
  const visualPeople = new Set(coverage.visualPeople ?? []);
  const galleryPeople = new Set(coverage.galleryPeople ?? []);
  for (const id of visualWorks) requireRef("fixture coverage", "visual work", id, indexes.works);
  for (const id of visualPeople) requireRef("fixture coverage", "visual person", id, indexes.people);
  for (const id of galleryPeople) requireRef("fixture coverage", "gallery person", id, indexes.people);

  // 示例库面向开发者和首次体验用户，因此不允许出现灰色占位卡：
  // 每部 Work 至少有 poster/cover，每位 Person 至少有 portrait。
  for (const work of collections.works) {
    if (!visualWorks.has(work.id)) errors.push(`fixture coverage: Work ${work.id} 未纳入 visualWorks`);
    const artwork = (work.assetIds ?? [])
      .map((id) => indexes.assets.get(id))
      .find((asset) => asset && asset.subjectType === "work" && asset.subjectId === work.id && ["poster", "cover"].includes(asset.type));
    if (!artwork) errors.push(`fixture coverage: Work ${work.id} 缺少可展示 poster / cover Asset`);
  }
  for (const person of collections.people) {
    if (!visualPeople.has(person.id)) errors.push(`fixture coverage: Person ${person.id} 未纳入 visualPeople`);
    const portrait = person.portraitAssetId ? indexes.assets.get(person.portraitAssetId) : null;
    if (!portrait || portrait.subjectType !== "person" || portrait.subjectId !== person.id || portrait.type !== "portrait") {
      errors.push(`fixture coverage: Person ${person.id} 缺少有效 portrait Asset`);
    }
    if (galleryPeople.has(person.id)) {
      const galleries = (person.galleryAssetIds ?? []).map((id) => indexes.assets.get(id)).filter(Boolean);
      if (!galleries.some((asset) => asset.subjectType === "person" && asset.subjectId === person.id && asset.type === "gallery")) {
        errors.push(`fixture coverage: Person ${person.id} 缺少独立 Gallery Asset`);
      }
    }
  }

  if (!(collections.works.some((work) => String(work.code ?? "").startsWith(coverage.relationshipShowcasePrefix ?? "DEMO-")))) {
    errors.push("Fixture 缺少用于筛选 / 关系展示的 DEMO-* 丰富样例。");
  }
}

async function validateLegacyDemoParity() {
  // Web 目前仍使用 data/demo-library 作为内置 Demo；Desktop Fixture 复用其中的
  // 关系型 Canonical 记录，但不复制旧文字型 SVG Asset。这里锁住共有实体的
  // 核心身份，避免两个 Demo 世界在后续重构中悄悄分叉。
  for (const collection of ["works", "people", "organizations", "series"]) {
    const sourceRoot = path.join(process.cwd(), "data", "demo-library", collection);
    let files = [];
    try { files = (await readdir(sourceRoot)).filter((item) => item.endsWith(".json")); }
    catch (error) {
      errors.push(`data/demo-library/${collection}: 无法读取 (${error.message})`);
      continue;
    }
    const targetIndex = indexes[collection];
    for (const fileName of files) {
      const source = await readJson(path.join(sourceRoot, fileName), `data/demo-library/${collection}/${fileName}`);
      if (!source?.id) continue;
      const target = targetIndex.get(source.id);
      if (!target) {
        errors.push(`Dev Fixture 缺少 Web Demo 关系实体：${collection}/${source.id}`);
        continue;
      }
      if (collection === "works" && target.code !== source.code) errors.push(`Dev Fixture / Web Demo Work 番号漂移：${source.id}`);
      if (collection === "people" && primaryJaName(target) !== primaryJaName(source)) errors.push(`Dev Fixture / Web Demo Person 主名称漂移：${source.id}`);
    }
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
    desktopSettingsExample: "examples/settings/desktop-settings.example.json",
    sharedPack: "examples/shared-packs/starter-community-pack",
    legacyJsonImport: "examples/imports/sample-demo-work.json",
    legacyNfoImport: "examples/imports/sample-demo-work.nfo",
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
    const allowedKeys = new Set(Object.keys(instanceSettingsSchema?.properties ?? {}));
    for (const key of Object.keys(settingsExample)) {
      if (!allowedKeys.has(key)) errors.push(`settings/settings.example.json: ${key} 不属于 Instance Settings Schema；Desktop-only 字段请放 desktop-settings.example.json`);
    }
    for (const key of instanceSettingsSchema?.required ?? []) {
      if (!(key in settingsExample)) errors.push(`settings/settings.example.json: 缺少 Schema required 字段 ${key}`);
    }
  }

  if (!desktopSettingsExample) {
    errors.push("settings/desktop-settings.example.json: 文件不可用");
  } else {
    if (desktopSettingsExample.libraryPath !== "./var/dev-fixture-library") {
      errors.push("settings/desktop-settings.example.json: libraryPath 应指向 ./var/dev-fixture-library");
    }
    const fixtureProfile = desktopSettingsExample.libraryProfiles?.find((profile) => profile.id === desktopSettingsExample.activeLibraryProfileId);
    if (!fixtureProfile || fixtureProfile.libraryPath !== "./var/dev-fixture-library") {
      errors.push("settings/desktop-settings.example.json: 必须包含并激活指向 Dev Fixture 的 Library Profile");
    } else if (fixtureProfile.name !== "示例库") {
      errors.push("settings/desktop-settings.example.json: Dev Fixture Profile 必须使用短名称“示例库”");
    }
    if (desktopSettingsExample.webUrl !== "http://127.0.0.1:3000") {
      errors.push("settings/desktop-settings.example.json: 应包含 Desktop 必需的 webUrl 示例");
    }
  }

  if (!legacyJsonImport || legacyJsonImport.code !== "DEMO-IMPORT-001") {
    errors.push("imports/sample-demo-work.json: 必须保留 DEMO-IMPORT-001 兼容导入示例");
  }
  if (!legacyNfoImport.includes("<num>DEMO-IMPORT-002</num>") || !legacyNfoImport.includes("白石りん")) {
    errors.push("imports/sample-demo-work.nfo: 必须保留 DEMO-IMPORT-002 / 白石りん兼容 NFO 示例");
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
