/**
 * 日期精度用于表达“只知道年份”或“只知道年月”的真实资料状态。
 *
 * 不强迫所有来源都补成虚假的 YYYY-MM-DD，能避免制造错误数据。
 */
export type DatePrecision = "year" | "month" | "day";

export interface PartialDate {
  value: string;
  precision: DatePrecision;
}

/**
 * 将可信字符串解析为带精度的日期；格式或日历日期无效时返回 undefined。
 *
 * 这条规则放在 Value Object 层，因为 NFO、审核提交、人物编辑和 Desktop 表单
 * 都会创建 PartialDate。共用实现可以防止某个入口接受 `2026-02-31`，另一个入口拒绝。
 */
export function parsePartialDate(value: string | undefined): PartialDate | undefined {
  if (!value) return undefined;
  if (/^\d{4}$/.test(value)) return { value, precision: "year" };
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { value, precision: "month" };
  const match = /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.exec(value);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? { value, precision: "day" }
    : undefined;
}
