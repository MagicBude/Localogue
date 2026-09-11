import { inferCatalogFilenameMetadata, normalizeNfoCode } from "../importers/nfo-filename-metadata.ts";

export type MediaRole = "main" | "trailer" | "sample" | "extra" | "unknown";
export type MediaRecognitionStatus = "recognized" | "needs_review" | "identity_conflict" | "unrecognized";

export interface MediaPartEvidence {
  index: number;
  token: string;
  kind: "explicit" | "contextual";
}

/**
 * 文件识别属于可重新计算的本地观察，不是 Work 的公共事实。
 *
 * 保留 filenameCode 与 nfoCode 两份证据很重要：如果二者冲突，扫描器必须停止
 * 自动绑定，让用户看到冲突，而不是用“优先采用某一个”的方式隐藏风险。
 */
export interface MediaRecognition {
  filenameCode?: string;
  nfoCode?: string;
  role: MediaRole;
  part?: MediaPartEvidence;
  editionTags: string[];
  status: MediaRecognitionStatus;
  reasons: string[];
}

export interface AnalyzeMediaIdentityInput {
  fileName: string;
  nfoCode?: string;
}

const explicitPartPattern = /(?:^|[\s._\-[\]()])(?:cd|disc|disk|dvd|part|pt)[\s._-]*(\d{1,3})(?=$|[\s._\-[\]()])/giu;
const contextualParts = new Map<string, number>([
  ["上部", 1], ["前編", 1], ["前篇", 1],
  ["下部", 2], ["後編", 2], ["后篇", 2], ["後篇", 2],
]);
const contextualPartPattern = /(?:^|[\s._\-[\]()])(上部|下部|前編|後編|前篇|后篇|後篇)(?=$|[\s._\-[\]()])/gu;
const editionRules: ReadonlyArray<[string, RegExp]> = [
  ["subtitled", /(?:^|[\s._\-[\]()])(中字|中文字幕|chinese|subtitle|sub|chs|cht)(?=$|[\s._\-[\]()])/iu],
  ["uncensored", /(?:^|[\s._\-[\]()])(uncensored|uncen|leaked|破解|无码|無碼)(?=$|[\s._\-[\]()])/iu],
  ["4k", /(?:^|[\s._\-[\]()])(2160p|4k)(?=$|[\s._\-[\]()])/iu],
  ["1080p", /(?:^|[\s._\-[\]()])1080p(?=$|[\s._\-[\]()])/iu],
];
const roleRules: ReadonlyArray<[MediaRole, RegExp]> = [
  ["trailer", /(?:^|[\s._\-[\]()])(trailer|预告|預告|pv)(?=$|[\s._\-[\]()])/iu],
  ["sample", /(?:^|[\s._\-[\]()])(sample|preview|試看|试看)(?=$|[\s._\-[\]()])/iu],
  ["extra", /(?:^|[\s._\-[\]()])(extra|bonus|花絮|特典)(?=$|[\s._\-[\]()])/iu],
];

export function analyzeMediaIdentity(input: AnalyzeMediaIdentityInput): MediaRecognition {
  const stem = input.fileName.replace(/\.[a-z0-9]{1,6}$/iu, "");
  const filenameCode = inferCatalogFilenameMetadata(input.fileName).code;
  const nfoCode = input.nfoCode ? normalizeNfoCode(input.nfoCode) : undefined;
  const part = findPart(stem);
  const editionTags = editionRules.filter(([, pattern]) => pattern.test(stem)).map(([tag]) => tag);
  const role = roleRules.find(([, pattern]) => pattern.test(stem))?.[0] ?? "main";
  const reasons: string[] = [];

  if (filenameCode && nfoCode && compactCode(filenameCode) !== compactCode(nfoCode)) {
    reasons.push("文件名番号与 NFO 番号冲突");
  }
  if (editionTags.length) reasons.push("检测到版本线索，需要按版本检查媒体");
  if (role !== "main") reasons.push("检测到预告、试看或花絮媒体");
  if (part?.kind === "contextual") reasons.push("分段来自上下篇语义，需要人工确认");

  const status: MediaRecognitionStatus = filenameCode && nfoCode && compactCode(filenameCode) !== compactCode(nfoCode)
    ? "identity_conflict"
    : !filenameCode && !nfoCode
      ? "unrecognized"
      : reasons.length
        ? "needs_review"
        : "recognized";

  return {
    ...(filenameCode ? { filenameCode } : {}),
    ...(nfoCode ? { nfoCode } : {}),
    role,
    ...(part ? { part } : {}),
    editionTags,
    status,
    reasons,
  };
}

function findPart(stem: string): MediaPartEvidence | undefined {
  const explicit = [...stem.matchAll(explicitPartPattern)].at(-1);
  if (explicit?.[1]) {
    const index = Number(explicit[1]);
    if (Number.isInteger(index) && index > 0) return { index, token: explicit[0].trim(), kind: "explicit" };
  }
  const contextual = [...stem.matchAll(contextualPartPattern)].at(-1);
  const token = contextual?.[1];
  const index = token ? contextualParts.get(token) : undefined;
  return index && token ? { index, token, kind: "contextual" } : undefined;
}

function compactCode(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
