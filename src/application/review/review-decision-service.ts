import type {
  EntityReviewDecision,
  ReviewDecisions,
} from "@/domain/entities/commit-plan";
import type { EntityResolution, EvidenceReviewAnalysis } from "@/domain/entities/review";

export type ResolutionKind =
  | "performer"
  | "director"
  | "maker"
  | "label"
  | "series"
  | "genre"
  | "tag"
  | "work_type";

/** UI 与服务端共同使用的稳定决策键，不依赖 Node.js API，因此 Client Component 也能安全导入。 */
export function entityDecisionKey(
  kind: ResolutionKind,
  index: number,
  sourceValue: string,
): string {
  return `${kind}:${index}:${sourceValue}`;
}

/** 根据保守策略提供默认值；“默认值”不是自动提交，用户仍必须显式生成 Plan 并确认。 */
export function createDefaultReviewDecisions(
  analysis: EvidenceReviewAnalysis,
): ReviewDecisions {
  const fields: ReviewDecisions["fields"] = {};
  for (const comparison of analysis.comparisons) {
    if (comparison.status === "same") continue;
    fields[comparison.field] =
      comparison.status === "library_only" ? "keep_library" : "use_evidence";
  }

  const entities: EntityReviewDecision[] = [];
  for (const item of enumerateResolutions(analysis)) {
    let action: EntityReviewDecision["action"];
    if (item.resolution.status === "matched") {
      action = "use_match";
    } else if (item.resolution.status === "new") {
      action = item.kind === "work_type" ? "skip" : "create_new";
    } else {
      // ambiguous / unresolved 不提供默认动作。
      // 用户必须在 Review UI 中明确绑定、创建或跳过，否则 Commit Plan 会阻塞。
      continue;
    }

    entities.push({
      key: item.key,
      action,
      targetId: action === "use_match" ? item.resolution.matchedId : undefined,
    });
  }
  return { fields, entities };
}

export function enumerateResolutions(analysis: EvidenceReviewAnalysis) {
  const result: Array<{
    kind: ResolutionKind;
    index: number;
    key: string;
    resolution: EntityResolution;
  }> = [];

  const add = (kind: ResolutionKind, values: EntityResolution[]) => {
    values.forEach((resolution, index) => {
      result.push({
        kind,
        index,
        key: entityDecisionKey(kind, index, resolution.sourceValue),
        resolution,
      });
    });
  };

  add("performer", analysis.performers);
  add("director", analysis.directors);
  add("maker", analysis.maker ? [analysis.maker] : []);
  add("label", analysis.label ? [analysis.label] : []);
  add("series", analysis.series);
  add("genre", analysis.genres);
  add("tag", analysis.tags);
  add("work_type", analysis.workTypes);
  return result;
}
