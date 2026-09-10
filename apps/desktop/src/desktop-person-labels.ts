/** 人物状态只在展示时翻译；详情、筛选器和卡片共用映射，不修改稳定枚举值。 */
export function personActivityStatusLabel(value: string, t: (source: string) => string): string {
  switch (value) {
    case "active": return t("活动中");
    case "retired": return t("已引退");
    case "hiatus": return t("暂停活动");
    case "inactive": return t("不活跃");
    case "unknown": return t("未知");
    default: return value;
  }
}
