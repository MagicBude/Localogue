import type { LocalizedText } from "@/domain/value-objects/localized-text";

/** Work 与 Person 表单共用的无状态规范化函数。 */
export function datePrecision(value: string): "year" | "month" | "day" {
  if (/^\d{4}$/.test(value)) return "year";
  if (/^\d{4}-\d{2}$/.test(value)) return "month";
  return "day";
}

/**
 * 校验允许不完整的日期，同时验证真实日历日期。
 * 单靠 `YYYY-MM-DD` 正则会错误接受 2026-02-31，因此完整日期还要往返 UTC Date。
 */
export function isValidPartialDate(value: string): boolean {
  if (/^\d{4}$/.test(value)) return true;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return true;
  const match = /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** 数量型 Domain 字段使用正整数，防止 1.5 或 Infinity 写入 Canonical JSON。 */
export function isPositiveInteger(value: string): boolean {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

export function compactLocalizedText(value: Record<"ja" | "zh-CN" | "en", string>): LocalizedText {
  return Object.fromEntries(Object.entries(value).map(([language, text]) => [language, text.trim()]).filter(([, text]) => text)) as LocalizedText;
}

/** 把未知异常转换成适合界面显示的字符串，同时保留 Error.message。 */
export function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
