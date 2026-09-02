import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { CanonicalCommitPlan, CommitOperationKind } from "@/domain/entities/commit-plan";
import type { CanonicalSnapshot, SnapshotEntry } from "@/domain/entities/snapshot";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { JsonFileStore, toSafeFileName } from "@/infrastructure/repositories/json-file-store";

const OPERATION_COLLECTION: Partial<Record<CommitOperationKind, string>> = {
  create_person: "people",
  create_organization: "organizations",
  create_series: "series",
  create_genre: "genres",
  create_tag: "tags",
  create_work: "works",
  update_work: "works",
};

function requirePrivateRoot(): string {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("当前未配置私人资料库，不能创建或恢复 Canonical Snapshot。");
  return root;
}

/**
 * 在正式 Commit 前保存“本次即将触碰的最小文件集合”。
 *
 * 与全量备份相比，这种快照体积小、含义明确，也方便学习数据库事务中的
 * before-image：提交前先记住旧状态，出错时才能恢复。
 */
export async function createCanonicalSnapshot(
  plan: CanonicalCommitPlan,
): Promise<CanonicalSnapshot> {
  const root = requirePrivateRoot();
  const relativePaths = new Set<string>();

  for (const operation of plan.operations) {
    const collection = OPERATION_COLLECTION[operation.kind];
    if (!collection) continue;
    relativePaths.add(`${collection}/${toSafeFileName(operation.entityId)}.json`);
  }

  // Provenance 会和 Work 在同一次 Commit 中追加，因此也必须进入 before-image。
  relativePaths.add(`provenance/${toSafeFileName(plan.targetWorkId)}.json`);
  // Evidence 生命周期会在成功 Commit 时从 pending 变为 committed，也属于本次事务边界。
  relativePaths.add(`evidence-lifecycle/${toSafeFileName(plan.evidenceId)}.json`);

  const entries: SnapshotEntry[] = [];
  for (const relativePath of [...relativePaths].sort()) {
    const absolutePath = safeResolve(root, relativePath);
    try {
      const content = await readFile(absolutePath, "utf8");
      entries.push({ relativePath, existed: true, content });
    } catch (error) {
      if (isMissingFileError(error)) {
        entries.push({ relativePath, existed: false });
        continue;
      }
      throw error;
    }
  }

  const timestamp = new Date().toISOString();
  const snapshot: CanonicalSnapshot = {
    schemaVersion: 1,
    id: `snapshot_${timestamp.replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`,
    createdAt: timestamp,
    evidenceId: plan.evidenceId,
    targetWorkId: plan.targetWorkId,
    targetWorkCode: plan.targetWorkCode,
    fingerprint: plan.fingerprint,
    entries,
  };

  await new JsonFileStore(root).writeEntity("snapshots", snapshot);
  return snapshot;
}

/**
 * 用户主动恢复前抓取“恢复动作开始前”的内存 guard。
 *
 * 这个 guard 不持久化为正式历史 Snapshot，只用于本次请求若中途失败时，
 * 尽量把 Canonical / Provenance / Lifecycle 再恢复到“恢复按钮点击前”。
 */
export async function captureCurrentStateForSnapshot(
  source: CanonicalSnapshot,
): Promise<CanonicalSnapshot> {
  const root = requirePrivateRoot();
  const entries: SnapshotEntry[] = [];
  for (const sourceEntry of source.entries) {
    const absolutePath = safeResolve(root, sourceEntry.relativePath);
    try {
      const content = await readFile(absolutePath, "utf8");
      entries.push({ relativePath: sourceEntry.relativePath, existed: true, content });
    } catch (error) {
      if (isMissingFileError(error)) {
        entries.push({ relativePath: sourceEntry.relativePath, existed: false });
        continue;
      }
      throw error;
    }
  }
  return {
    schemaVersion: 1,
    id: `restore_guard_${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    evidenceId: source.evidenceId,
    targetWorkId: source.targetWorkId,
    targetWorkCode: source.targetWorkCode,
    fingerprint: source.fingerprint,
    entries,
  };
}

export async function findCanonicalSnapshotById(id: string): Promise<CanonicalSnapshot | null> {
  const root = requirePrivateRoot();
  const snapshots = await new JsonFileStore(root).readCollection<CanonicalSnapshot>("snapshots");
  return snapshots.find((item) => item.id === id) ?? null;
}

/** 恢复快照本身不删除 Snapshot；Snapshot 是审计记录，应该继续保留。 */
export async function restoreCanonicalSnapshot(
  snapshot: CanonicalSnapshot,
  options: { includeAuditState?: boolean } = {},
): Promise<void> {
  const root = requirePrivateRoot();
  const includeAuditState = options.includeAuditState ?? false;

  for (const entry of snapshot.entries) {
    // 用户主动恢复历史版本时，Provenance 本身属于审计历史，不能被倒回删除。
    // 自动回滚“失败的 Commit”时则应恢复 Provenance，仿真一次真正没有发生过的事务。
    if (!includeAuditState && entry.relativePath.startsWith("provenance/")) continue;
    const absolutePath = safeResolve(root, entry.relativePath);
    if (!entry.existed) {
      try {
        await unlink(absolutePath);
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }
      continue;
    }

    if (entry.content === undefined) {
      throw new Error(`Snapshot 条目缺少原始内容：${entry.relativePath}`);
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.restore.tmp`;
    await writeFile(temporaryPath, entry.content, "utf8");
    await rename(temporaryPath, absolutePath);
  }
}

function safeResolve(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
    throw new Error(`Snapshot 包含不安全路径：${relativePath}`);
  }
  const resolved = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root) + path.sep;
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`Snapshot 路径越界：${relativePath}`);
  }
  return resolved;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
