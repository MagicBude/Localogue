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
