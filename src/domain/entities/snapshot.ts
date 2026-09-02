/**
 * JSON 阶段的 Canonical Snapshot。
 *
 * 它不是整个资料库的全量备份，而是一次 Commit 即将触碰文件的“最小快照”。
 * existed=false 表示提交前该文件不存在；恢复时应删除本次提交创建的文件。
 */
export interface SnapshotEntry {
  relativePath: string;
  existed: boolean;
  content?: string;
}

export interface CanonicalSnapshot {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  evidenceId: string;
  targetWorkId: string;
  targetWorkCode: string;
  fingerprint: string;
  entries: SnapshotEntry[];
}

export interface CanonicalRestoreReceipt {
  schemaVersion: 1;
  id: string;
  commitReceiptId: string;
  snapshotId: string;
  targetWorkId: string;
  targetWorkCode: string;
  restoredAt: string;
  restoredEntryCount: number;
}
