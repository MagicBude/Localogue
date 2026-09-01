import { createHash } from "node:crypto";

import type { Genre, Tag } from "@/domain/entities/classification";
import type {
  CanonicalCommitPlan,
  CommitOperation,
  ReviewDecisions,
} from "@/domain/entities/commit-plan";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { Organization } from "@/domain/entities/organization";
import type { Person, PersonName } from "@/domain/entities/person";
import type { EntityResolution, EvidenceReviewAnalysis } from "@/domain/entities/review";
import type { Series } from "@/domain/entities/series";
import type { Work, WorkPersonRelation } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { PartialDate } from "@/domain/value-objects/partial-date";
import { normalizeIdentityText } from "@/application/review/entity-resolution-service";
import {
  entityDecisionKey,
  enumerateResolutions,
  type ResolutionKind,
} from "@/application/review/review-decision-service";

export interface CommitWrites {
  people: Person[];
  organizations: Organization[];
  series: Series[];
  genres: Genre[];
  tags: Tag[];
  work: Work;
}

export interface BuiltCommitPlan {
  plan: CanonicalCommitPlan;
  writes: CommitWrites;
}

/**
 * 从 Evidence + Review Analysis + 用户决策生成“只读 Commit Plan”。
 *
 * 注意：这里绝不写文件。真正写入由 commit-executor.ts 负责。
 */
export async function buildCanonicalCommitPlan(
  evidence: EvidenceRecord,
  analysis: EvidenceReviewAnalysis,
  decisions: ReviewDecisions,
  library: LibraryRepository,
  privateLibraryConfigured: boolean,
): Promise<BuiltCommitPlan> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const operations: CommitOperation[] = [];

  if (!privateLibraryConfigured) {
    blockers.push("当前处于只读 Demo 模式。请先配置 LOCALOGUE_LIBRARY_PATH 指向私人资料库。");
  }
  if (!evidence.normalized.code) blockers.push("缺少番号，无法创建稳定的 Canonical Work。");

  const existingWork = analysis.matchedWorkId
    ? await library.findWorkById(analysis.matchedWorkId)
    : null;
  const mode: CanonicalCommitPlan["mode"] = existingWork ? "update" : "create";

  if (!existingWork && !(evidence.normalized.originalTitle ?? evidence.normalized.title)) {
    blockers.push("新作品缺少标题，暂不允许正式归档。");
  }

  const newPeople: Person[] = [];
  const newOrganizations: Organization[] = [];
  const newSeries: Series[] = [];
  const newGenres: Genre[] = [];
  const newTags: Tag[] = [];

  const entityIdByKey = new Map<string, string>();
  const createdEntityIds = new Set<string>();
  const decisionsByKey = new Map(decisions.entities.map((item) => [item.key, item]));

  for (const item of enumerateResolutions(analysis)) {
    // 已有 Work 如果明确选择“保留资料库”这一关系字段，
    // 对应 Evidence 中的新实体也不应被孤立创建。
    const relatedField = resolutionKindToField(item.kind);
    const usesEvidenceRelation =
      !existingWork || decisions.fields[relatedField] === "use_evidence";
    if (!usesEvidenceRelation) continue;

    const decision = decisionsByKey.get(item.key);
    if (!decision) {
      blockers.push(`实体“${item.resolution.sourceValue}”缺少审核决策。`);
      continue;
    }

    if (decision.action === "skip") {
      if (["ambiguous", "unresolved"].includes(item.resolution.status)) {
        warnings.push(`已跳过未解决实体：${item.resolution.sourceValue}`);
      }
      if (item.kind === "work_type" && item.resolution.status === "new") {
        warnings.push(`未知作品类型“${item.resolution.sourceValue}”未写入；请先映射到受控 Work Type。`);
      }
      continue;
    }

    if (decision.action === "use_match") {
      if (!item.resolution.matchedId) {
        blockers.push(`实体“${item.resolution.sourceValue}”没有唯一匹配，不能使用 use_match。`);
        continue;
      }
      entityIdByKey.set(item.key, item.resolution.matchedId);
      continue;
    }

    if (decision.action === "bind_existing") {
      const candidate = item.resolution.candidates.find((value) => value.id === decision.targetId);
      if (!candidate) {
        blockers.push(`实体“${item.resolution.sourceValue}”指定的已有实体不存在于候选列表。`);
        continue;
      }
      entityIdByKey.set(item.key, candidate.id);
      continue;
    }

    if (decision.action === "create_new") {
      if (item.kind === "work_type") {
        blockers.push(`作品类型“${item.resolution.sourceValue}”属于受控词表，不能直接创建。`);
        continue;
      }
      if (item.resolution.status === "ambiguous") {
        warnings.push(`你明确选择为歧义名称“${item.resolution.sourceValue}”创建新实体，请再次核对。`);
      }

      const id = stableEntityId(evidence.id, item.kind, item.resolution.sourceValue);
      entityIdByKey.set(item.key, id);
      const label = item.resolution.sourceValue;

      // 同一 Evidence 中相同人物可能同时以演员/导演出现；稳定 ID 可让它们共享一个实体。
      if (createdEntityIds.has(id)) continue;
      createdEntityIds.add(id);

      switch (item.kind) {
        case "performer":
        case "director": {
          const person = makePerson(id, label, evidence.importedAt);
          newPeople.push(person);
          operations.push({
            kind: "create_person",
            entityId: id,
            label,
            detail: `创建人物并用于${item.kind === "performer" ? "演员" : "导演"}关系`,
            after: person,
          });
          break;
        }
        case "maker":
        case "label": {
          const parentOrganizationId =
            item.kind === "label" && analysis.maker
              ? entityIdByKey.get(entityDecisionKey("maker", 0, analysis.maker.sourceValue))
              : undefined;
          const organization = makeOrganization(id, label, item.kind, parentOrganizationId);
          newOrganizations.push(organization);
          operations.push({
            kind: "create_organization",
            entityId: id,
            label,
            detail: `创建${item.kind === "maker" ? "Maker" : "Label"}实体`,
            after: organization,
          });
          break;
        }
        case "series": {
          const entity: Series = { schemaVersion: 1, id, names: localizedSourceName(label) };
          newSeries.push(entity);
          operations.push({ kind: "create_series", entityId: id, label, detail: "创建 Series 实体", after: entity });
          break;
        }
        case "genre": {
          const entity: Genre = { id, names: localizedSourceName(label) };
          newGenres.push(entity);
          operations.push({ kind: "create_genre", entityId: id, label, detail: "创建新的资料库 Genre", after: entity });
          warnings.push(`Genre“${label}”作为新 Canonical Genre 创建；后续仍可在词表治理中合并或映射。`);
          break;
        }
        case "tag": {
          const entity: Tag = { id, names: localizedSourceName(label), builtIn: false };
          newTags.push(entity);
          operations.push({ kind: "create_tag", entityId: id, label, detail: "创建用户 Tag", after: entity });
          break;
        }
      }
    }
  }

  const targetWorkId = existingWork?.id ?? stableWorkId(evidence.normalized.code ?? evidence.id);
  const nextWork = buildTargetWork(evidence, analysis, existingWork, decisions, entityIdByKey, targetWorkId);

  if (existingWork) {
    const changedFields = changedWorkFields(existingWork, nextWork);
    if (changedFields.length) {
      operations.push({
        kind: "update_work",
        entityId: existingWork.id,
        label: existingWork.code,
        detail: `更新 Work：${changedFields.join("、")}`,
        before: pickWorkForPlan(existingWork),
        after: pickWorkForPlan(nextWork),
      });
    }
  } else {
    operations.push({
      kind: "create_work",
      entityId: targetWorkId,
      label: nextWork.code,
      detail: "创建新的 Canonical Work",
      after: pickWorkForPlan(nextWork),
    });
  }

  // 计划指纹故意不包含 generatedAt；同一资料状态 + 同一决策应得到同一指纹。
  const fingerprintSource = JSON.stringify({
    evidenceId: evidence.id,
    targetWorkId,
    operations,
    blockers,
    warnings,
  });
  const fingerprint = createHash("sha256").update(fingerprintSource).digest("hex");

  return {
    plan: {
      schemaVersion: 1,
      evidenceId: evidence.id,
      generatedAt: new Date().toISOString(),
      mode,
      targetWorkId,
      targetWorkCode: nextWork.code,
      operations,
      blockers,
      warnings,
      fingerprint,
    },
    writes: {
      people: uniqueById(newPeople),
      organizations: uniqueById(newOrganizations),
      series: uniqueById(newSeries),
      genres: uniqueById(newGenres),
      tags: uniqueById(newTags),
      work: nextWork,
    },
  };
}


function resolutionKindToField(
  kind: ResolutionKind,
): "performers" | "directors" | "maker" | "label" | "series" | "genres" | "tags" | "workTypes" {
  switch (kind) {
    case "performer": return "performers";
    case "director": return "directors";
    case "maker": return "maker";
    case "label": return "label";
    case "series": return "series";
    case "genre": return "genres";
    case "tag": return "tags";
    case "work_type": return "workTypes";
  }
}

function buildTargetWork(
  evidence: EvidenceRecord,
  analysis: EvidenceReviewAnalysis,
  current: Work | null,
  decisions: ReviewDecisions,
  entityIdByKey: Map<string, string>,
  targetWorkId: string,
): Work {
  const normalized = evidence.normalized;
  const isNew = current === null;
  const choose = (field: keyof ReviewDecisions["fields"]): boolean =>
    isNew || decisions.fields[field] === "use_evidence";

  const nowPlaceholder = current?.updatedAt ?? evidence.importedAt;
  const base: Work = current
    ? structuredClone(current)
    : {
        schemaVersion: 1,
        id: targetWorkId,
        code: normalized.code ?? "UNKNOWN",
        originalLanguage: "ja",
        titles: {},
        workTypeIds: [],
        personRelations: [],
        seriesIds: [],
        genreIds: [],
        tagIds: [],
        assetIds: [],
        mediaFileIds: [],
        createdAt: evidence.importedAt,
        updatedAt: evidence.importedAt,
      };

  if (choose("code") && normalized.code) base.code = normalized.code;
  if (choose("title")) {
    const japaneseTitle = normalized.originalTitle ?? normalized.title;
    if (japaneseTitle) base.titles = { ...base.titles, ja: japaneseTitle };
  }
  if (choose("description") && normalized.description) {
    base.descriptions = { ...(base.descriptions ?? {}), ja: normalized.description };
  }
  if (choose("releaseDate")) base.releaseDate = toPartialDate(normalized.releaseDate);
  if (choose("durationMinutes")) base.durationMinutes = normalized.durationMinutes;

  if (choose("performers") || choose("directors")) {
    const preserved = base.personRelations.filter((relation) => {
      if (relation.role === "performer") return !choose("performers");
      if (relation.role === "director") return !choose("directors");
      return true;
    });
    const replacements: WorkPersonRelation[] = [];
    if (choose("performers")) {
      analysis.performers.forEach((resolution, index) => {
        const id = entityIdByKey.get(entityDecisionKey("performer", index, resolution.sourceValue));
        if (id) replacements.push({ personId: id, role: "performer", billingOrder: index + 1 });
      });
    }
    if (choose("directors")) {
      analysis.directors.forEach((resolution, index) => {
        const id = entityIdByKey.get(entityDecisionKey("director", index, resolution.sourceValue));
        if (id) replacements.push({ personId: id, role: "director", billingOrder: index + 1 });
      });
    }
    base.personRelations = [...preserved, ...replacements];
  }

  if (choose("maker")) {
    base.makerId = analysis.maker
      ? entityIdByKey.get(entityDecisionKey("maker", 0, analysis.maker.sourceValue))
      : undefined;
  }
  if (choose("label")) {
    base.labelId = analysis.label
      ? entityIdByKey.get(entityDecisionKey("label", 0, analysis.label.sourceValue))
      : undefined;
  }
  if (choose("series")) base.seriesIds = resolvedIds("series", analysis.series, entityIdByKey);
  if (choose("genres")) base.genreIds = resolvedIds("genre", analysis.genres, entityIdByKey);
  if (choose("tags")) base.tagIds = resolvedIds("tag", analysis.tags, entityIdByKey);
  if (choose("workTypes")) base.workTypeIds = resolvedIds("work_type", analysis.workTypes, entityIdByKey);

  base.updatedAt = nowPlaceholder;
  return base;
}

function resolvedIds(
  kind: ResolutionKind,
  resolutions: EntityResolution[],
  ids: Map<string, string>,
): string[] {
  return resolutions
    .map((resolution, index) => ids.get(entityDecisionKey(kind, index, resolution.sourceValue)))
    .filter((id): id is string => Boolean(id));
}

function makePerson(id: string, value: string, timestamp: string): Person {
  const name: PersonName = { language: inferSourceLanguage(value), value, type: "primary" };
  return {
    schemaVersion: 1,
    id,
    names: [name],
    activityStatus: "unknown",
    careerEvents: [],
    galleryAssetIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function makeOrganization(
  id: string,
  value: string,
  kind: "maker" | "label",
  parentOrganizationId?: string,
): Organization {
  return {
    schemaVersion: 1,
    id,
    kind,
    names: localizedSourceName(value),
    parentOrganizationId,
  };
}

function inferSourceLanguage(value: string): "ja" | "en" {
  // 这是 V1 的保守启发式：纯拉丁字符更适合作为 en / romanized 输入，
  // 含日文假名或汉字时仍按本项目默认原文语言 ja 保存。后续 Review 可补充人工语言选择。
  return /^[\p{Script=Latin}\p{Number} ._&+()'’\-]+$/u.test(value) ? "en" : "ja";
}

function localizedSourceName(value: string) {
  const language = inferSourceLanguage(value);
  return language === "en" ? { en: value } : { ja: value };
}

function stableEntityId(
  evidenceId: string,
  kind: ResolutionKind,
  value: string,
): string {
  const entityClass = kind === "performer" || kind === "director" ? "person" : kind;
  const token = createHash("sha256")
    .update(`${evidenceId}|${entityClass}|${normalizeIdentityText(value)}`)
    .digest("hex")
    .slice(0, 12);
  const prefix = kind === "performer" || kind === "director" ? "person" : kind;
  return `${prefix}_${token}`;
}

function stableWorkId(code: string): string {
  const normalized = code.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized ? `work_${normalized}` : `work_${createHash("sha256").update(code).digest("hex").slice(0, 12)}`;
}

function toPartialDate(value: string | undefined): PartialDate | undefined {
  if (!value) return undefined;
  if (/^\d{4}$/.test(value)) return { value, precision: "year" };
  if (/^\d{4}-\d{2}$/.test(value)) return { value, precision: "month" };
  return { value, precision: "day" };
}

function changedWorkFields(before: Work, after: Work): string[] {
  const fields: Array<[string, unknown, unknown]> = [
    ["番号", before.code, after.code],
    ["标题", before.titles, after.titles],
    ["简介", before.descriptions, after.descriptions],
    ["发行日期", before.releaseDate, after.releaseDate],
    ["时长", before.durationMinutes, after.durationMinutes],
    ["人物关系", before.personRelations, after.personRelations],
    ["Maker", before.makerId, after.makerId],
    ["Label", before.labelId, after.labelId],
    ["Series", before.seriesIds, after.seriesIds],
    ["Genre", before.genreIds, after.genreIds],
    ["Tag", before.tagIds, after.tagIds],
    ["作品类型", before.workTypeIds, after.workTypeIds],
  ];
  return fields.filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b)).map(([name]) => name);
}

function pickWorkForPlan(work: Work) {
  const { updatedAt: _updatedAt, ...stable } = work;
  return stable;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
