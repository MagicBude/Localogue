import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { resolvePrivateRuntimeRoot } from "./lib/runtime-settings.mjs";

/**
 * V1-08 审计数据完整性检查。
 *
 * validate:data 检查 Canonical 实体关系；本脚本专门检查“历史系统”内部引用：
 * Commit Receipt → Snapshot、Lifecycle → Commit、Restore → Commit/Snapshot、
 * Provenance → Commit/Restore。两类校验分开可以更清楚地理解职责。
 */
const root = resolvePrivateRuntimeRoot();

const errors = [];
const commits = await readCollection("review-commits");
const snapshots = await readCollection("snapshots");
const restores = await readCollection("restore-receipts");
const provenanceLogs = await readCollection("provenance");
const lifecycles = await readCollection("evidence-lifecycle");
const evidence = await readCollection("evidence");
const personEdits = await readCollection("person-edits");
const presentationPreferences = await readCollection("presentation-preferences");
const privateAssets = await readCollection("assets");

const byId = (items) => new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
const commitById = byId(commits);
const snapshotById = byId(snapshots);
const restoreById = byId(restores);
const evidenceById = byId(evidence);
const privateAssetById = byId(privateAssets);

for (const commit of commits) {
  if (!commit.evidenceId || !evidenceById.has(commit.evidenceId)) {
    errors.push(`commit ${commit.id}: Evidence 不存在 (${commit.evidenceId ?? "<empty>"})`);
  }
  if (commit.schemaVersion >= 2) {
    if (!commit.snapshotId) {
      errors.push(`commit ${commit.id}: schemaVersion>=2 但缺少 snapshotId`);
    } else if (!snapshotById.has(commit.snapshotId)) {
      errors.push(`commit ${commit.id}: Snapshot 不存在 (${commit.snapshotId})`);
    }
    if (!Array.isArray(commit.operations)) {
      errors.push(`commit ${commit.id}: schemaVersion>=2 但缺少 operations`);
    }
  }
}

for (const snapshot of snapshots) {
  if (!Array.isArray(snapshot.entries)) {
    errors.push(`snapshot ${snapshot.id}: entries 不是数组`);
    continue;
  }
  for (const entry of snapshot.entries) {
    const relativePath = String(entry.relativePath ?? "");
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
      errors.push(`snapshot ${snapshot.id}: 不安全 relativePath (${relativePath || "<empty>"})`);
    }
    if (entry.existed && typeof entry.content !== "string") {
      errors.push(`snapshot ${snapshot.id}: existed=true 的条目缺少 content (${relativePath})`);
    }
  }
}

for (const restore of restores) {
  if (!commitById.has(restore.commitReceiptId)) {
    errors.push(`restore ${restore.id}: Commit Receipt 不存在 (${restore.commitReceiptId})`);
  }
  if (!snapshotById.has(restore.snapshotId)) {
    errors.push(`restore ${restore.id}: Snapshot 不存在 (${restore.snapshotId})`);
  }
}

for (const lifecycle of lifecycles) {
  if (!evidenceById.has(lifecycle.evidenceId)) {
    errors.push(`lifecycle ${lifecycle.id}: Evidence 不存在 (${lifecycle.evidenceId})`);
  }
  if (lifecycle.status === "committed") {
    if (!lifecycle.commitReceiptId || !commitById.has(lifecycle.commitReceiptId)) {
      errors.push(`lifecycle ${lifecycle.id}: committed 状态缺少有效 commitReceiptId`);
    }
  }
}

for (const log of provenanceLogs) {
  if (!Array.isArray(log.events)) {
    errors.push(`provenance ${log.id}: events 不是数组`);
    continue;
  }
  for (const event of log.events) {
    if (event.commitId && !commitById.has(event.commitId)) {
      errors.push(`provenance ${event.id}: Commit Receipt 不存在 (${event.commitId})`);
    }
    if (event.restoreReceiptId && !restoreById.has(event.restoreReceiptId)) {
      errors.push(`provenance ${event.id}: Restore Receipt 不存在 (${event.restoreReceiptId})`);
    }
    if (event.evidenceId && !evidenceById.has(event.evidenceId)) {
      errors.push(`provenance ${event.id}: Evidence 不存在 (${event.evidenceId})`);
    }
  }
}

for (const edit of personEdits) {
  if (!edit.personId || !edit.before || !edit.after) {
    errors.push(`person-edit ${edit.id}: 缺少 personId / before / after`);
    continue;
  }
  if (edit.before.id !== edit.personId || edit.after.id !== edit.personId) {
    errors.push(`person-edit ${edit.id}: before/after 与 personId 不一致`);
  }
  if (!Array.isArray(edit.changedFields) || !edit.changedFields.length) {
    errors.push(`person-edit ${edit.id}: changedFields 为空或不是数组`);
  }
}

for (const preference of presentationPreferences) {
  if (!preference.entityType || !preference.entityId) {
    errors.push(`presentation-preference ${preference.id}: 缺少 entityType / entityId`);
  }
  for (const assetId of [preference.preferredPortraitAssetId, preference.preferredCoverAssetId].filter(Boolean)) {
    // Community Asset 可能不在私人 assets/，所以这里只在本地存在同 ID 时做结构确认，
    // 真实跨层引用由 Web Repository 在运行时解析。
    if (privateAssetById.has(assetId) && !privateAssetById.get(assetId)?.storagePath) {
      errors.push(`presentation-preference ${preference.id}: 本地 Asset 缺少 storagePath (${assetId})`);
    }
  }
}

if (errors.length) {
  console.error("\nLocalogue 审计数据校验失败：\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Localogue 审计数据校验通过。\n");
  console.table({
    commits: commits.length,
    snapshots: snapshots.length,
    restores: restores.length,
    provenanceLogs: provenanceLogs.length,
    lifecycles: lifecycles.length,
    evidence: evidence.length,
    personEdits: personEdits.length,
    presentationPreferences: presentationPreferences.length,
  });
}

async function readCollection(name) {
  const directory = path.join(root, name);
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    errors.push(`${name}: 无法读取目录 (${error.message})`);
    return [];
  }

  const items = [];
  for (const fileName of names.filter((item) => item.endsWith(".json")).sort()) {
    try {
      items.push(JSON.parse(await readFile(path.join(directory, fileName), "utf8")));
    } catch (error) {
      errors.push(`${name}/${fileName}: JSON 无法解析 (${error.message})`);
    }
  }
  return items;
}
