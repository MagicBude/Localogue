/**
 * MediaFile 人工绑定属于 Private Layer 的治理操作。
 *
 * 自动扫描器只允许建立保守、可解释的 code 匹配；一旦需要人工判断，
 * 应显式记录“用户把哪个本地文件绑定到了哪个 Work”，而不是静默改 JSON。
 */
export interface MediaBindingCandidate {
  workId: string;
  code: string;
  title: string;
  score: number;
  reasons: string[];
}

export interface MediaBindingReceipt {
  schemaVersion: 1;
  id: string;
  mediaFileId: string;
  /** 保留当时路径快照；MediaFile 以后被清理时审计记录仍有上下文。 */
  mediaFilePath: string;
  beforeWorkId?: string;
  afterWorkId?: string;
  action: "bind" | "rebind" | "unbind";
  changedAt: string;
}
