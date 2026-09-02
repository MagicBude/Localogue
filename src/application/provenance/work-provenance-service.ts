import type { CanonicalCommitPlan, CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { FieldProvenanceEvent, ProvenanceField } from "@/domain/entities/provenance";
import type { Work } from "@/domain/entities/work";

const ALL_FIELDS: ProvenanceField[] = [
  "code",
  "title",
  "releaseDate",
  "durationMinutes",
  "description",
  "performers",
  "directors",
  "maker",
  "label",
  "series",
  "genres",
  "tags",
  "workTypes",
];

/**
 * 根据本次真正写入 Work 的 before / after 生成字段级来源事件。
 *
 * 这里不从 UI 决策重新猜，而是以 Commit Plan 的最终 before/after 为准：
 * 只有最终 Canonical 值发生变化的字段才新增 Provenance 事件。
 */
export function buildAdoptedProvenanceEvents(
  evidence: EvidenceRecord,
  plan: CanonicalCommitPlan,
  commitId: string,
): Array<Omit<FieldProvenanceEvent, "schemaVersion" | "id" | "workId">> {
  const workOperation = plan.operations.find(
    (operation) => operation.kind === "create_work" || operation.kind === "update_work",
  );
  if (!workOperation?.after) return [];

  const after = workOperation.after as Work;
  const before = workOperation.before ? (workOperation.before as Work) : null;
  const recordedAt = new Date().toISOString();

  return ALL_FIELDS.filter((field) => {
    if (before) return !same(extractField(before, field), extractField(after, field));
    return evidenceProvidesField(evidence, field);
  }).map((field) => ({
    field,
    eventType: "adopted" as const,
    evidenceId: evidence.id,
    sourceType: evidence.sourceType,
    sourceName: evidence.sourceName,
    commitId,
    recordedAt,
    value: extractField(after, field),
  }));
}

/** 恢复时追加一组 restored 事件，让“为什么当前值又变回去了”也可解释。 */
export function buildRestoredProvenanceEvents(
  commit: CanonicalCommitReceipt,
  restoreReceiptId: string,
  restoredWork: Work | null,
): Array<Omit<FieldProvenanceEvent, "schemaVersion" | "id" | "workId">> {
  const workOperation = commit.operations?.find(
    (operation) => operation.kind === "create_work" || operation.kind === "update_work",
  );
  if (!workOperation) return [];

  const before = workOperation.before ? (workOperation.before as Work) : null;
  const after = workOperation.after ? (workOperation.after as Work) : null;
  if (!after) return [];

  const fields = ALL_FIELDS.filter((field) => {
    if (!before) return evidenceLikeValueExists(extractField(after, field));
    return !same(extractField(before, field), extractField(after, field));
  });
  const recordedAt = new Date().toISOString();

  return fields.map((field) => ({
    field,
    eventType: "restored" as const,
    commitId: commit.id,
    restoreReceiptId,
    recordedAt,
    value: restoredWork ? extractField(restoredWork, field) : null,
  }));
}

export function extractField(work: Work, field: ProvenanceField): unknown {
  switch (field) {
    case "code": return work.code;
    case "title": return work.titles.ja ?? null;
    case "description": return work.descriptions?.ja ?? null;
    case "releaseDate": return work.releaseDate?.value ?? null;
    case "durationMinutes": return work.durationMinutes ?? null;
    case "performers":
      return work.personRelations.filter((item) => item.role === "performer").map((item) => item.personId);
    case "directors":
      return work.personRelations.filter((item) => item.role === "director").map((item) => item.personId);
    case "maker": return work.makerId ?? null;
    case "label": return work.labelId ?? null;
    case "series": return work.seriesIds;
    case "genres": return work.genreIds;
    case "tags": return work.tagIds;
    case "workTypes": return work.workTypeIds;
  }
}

function evidenceProvidesField(evidence: EvidenceRecord, field: ProvenanceField): boolean {
  const value = evidence.normalized;
  switch (field) {
    case "code": return Boolean(value.code);
    case "title": return Boolean(value.originalTitle ?? value.title);
    case "description": return Boolean(value.description);
    case "releaseDate": return Boolean(value.releaseDate);
    case "durationMinutes": return value.durationMinutes !== undefined;
    case "performers": return value.performers.length > 0;
    case "directors": return value.directors.length > 0;
    case "maker": return Boolean(value.maker);
    case "label": return Boolean(value.label);
    case "series": return value.series.length > 0;
    case "genres": return value.genres.length > 0;
    case "tags": return value.tags.length > 0;
    case "workTypes": return value.workTypes.length > 0;
  }
}

function evidenceLikeValueExists(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
