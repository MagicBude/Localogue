import type { ImportWarning, NormalizedImportCandidate } from "@/domain/entities/evidence";

/**
 * V1-04 只做“导入前基本质量检查”。
 * 真正的重复作品、人物匹配和字段冲突会放到后续 Review 阶段。
 */
export function validateImportCandidate(candidate: NormalizedImportCandidate): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  if (!candidate.code) warnings.push({ code: "missing_code" });
  if (!candidate.title && !candidate.originalTitle) warnings.push({ code: "missing_title" });
  if (candidate.durationMinutes !== undefined && candidate.durationMinutes <= 0) {
    warnings.push({ code: "invalid_duration" });
  }
  if (!candidate.performers.length) warnings.push({ code: "missing_performers" });

  return warnings;
}
