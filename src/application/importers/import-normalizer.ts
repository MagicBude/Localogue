import type { NormalizedImportCandidate } from "@/domain/entities/evidence";

/**
 * 把不同来源中常见的“近义字段”整理为 Localogue 的统一导入候选结构。
 *
 * 这一层刻意不创建 Work / Person ID，因为“字符串演员名到底对应哪个 Person”
 * 属于 Entity Resolution / Review 的职责，不应该在 Parser 阶段偷偷猜测。
 */
export function normalizeLooseRecord(input: Record<string, unknown>): NormalizedImportCandidate {
  const get = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (input[key] !== undefined && input[key] !== null && input[key] !== "") {
        return input[key];
      }
    }
    return undefined;
  };

  return {
    code: text(get("code", "number", "productid", "id", "番号", "品番")),
    title: text(get("title", "name", "localizedTitle", "标题", "標題", "タイトル")),
    originalTitle: text(get("originalTitle", "originaltitle", "original_title", "原始标题", "原題")),
    releaseDate: normalizeDate(text(get("releaseDate", "release_date", "premiered", "date", "发行日期", "発売日"))),
    durationMinutes: minutes(get("durationMinutes", "duration", "runtime", "length", "时长", "収録時間")),
    performers: strings(get("performers", "actors", "actor", "actresses", "actress", "cast", "演员", "出演者")),
    directors: strings(get("directors", "director", "导演", "監督")),
    maker: text(get("maker", "makerName", "makername", "studio", "studioName", "厂商", "メーカー")),
    label: text(get("label", "labelName", "厂牌", "レーベル")),
    series: strings(get("series", "seriesName", "set", "系列", "シリーズ")),
    genres: strings(get("genres", "genre", "分类", "類型", "ジャンル")),
    tags: strings(get("tags", "tag", "标签", "タグ")),
    workTypes: strings(get("workTypes", "workType", "type", "作品类型", "作品タイプ")),
    description: text(get("description", "plot", "outline", "summary", "简介", "紹介")),
  };
}

/** Localogue 原生 Work JSON 比普通扁平 JSON 多一层 titles / personRelations。 */
export function normalizeLocalogueWork(input: Record<string, unknown>): NormalizedImportCandidate {
  const titles = isRecord(input.titles) ? input.titles : {};
  const relations = Array.isArray(input.personRelations) ? input.personRelations : [];

  const relationNames = (role: string): string[] =>
    relations
      .filter(isRecord)
      .filter((item) => item.role === role)
      .map((item) => text(item.personId))
      .filter((value): value is string => Boolean(value));

  return {
    code: text(input.code),
    title: text(titles["zh-CN"]) ?? text(titles.ja) ?? text(titles.en),
    originalTitle: text(titles.ja),
    releaseDate: partialDateToString(input.releaseDate),
    durationMinutes: minutes(input.durationMinutes),
    performers: relationNames("performer"),
    directors: relationNames("director"),
    maker: text(input.makerId),
    label: text(input.labelId),
    series: strings(input.seriesIds),
    genres: strings(input.genreIds),
    tags: strings(input.tagIds),
    workTypes: strings(input.workTypeIds),
    description: undefined,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(strings).filter(uniqueNonEmpty);
  }

  const valueText = text(value);
  if (!valueText) return [];

  return valueText
    .split(/[|,，、;/]+/u)
    .map((item) => item.trim())
    .filter(uniqueNonEmpty);
}

function uniqueNonEmpty(value: string, index: number, array: string[]): boolean {
  return Boolean(value) && array.indexOf(value) === index;
}

function minutes(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));

  const valueText = text(value);
  if (!valueText) return undefined;

  // 同时兼容 "125"、"125 min"、"02:05:00" 等常见写法。
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(valueText)) {
    const parts = valueText.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  }

  const match = valueText.match(/\d+(?:\.\d+)?/);
  return match ? Math.max(0, Math.round(Number(match[0]))) : undefined;
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!match) return value;

  const [, year, month, day] = match;
  if (!month) return year;
  if (!day) return `${year}-${month.padStart(2, "0")}`;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function partialDateToString(value: unknown): string | undefined {
  if (typeof value === "string") return normalizeDate(value);
  if (!isRecord(value)) return undefined;

  const year = typeof value.year === "number" ? value.year : undefined;
  if (!year) return undefined;
  const month = typeof value.month === "number" ? value.month : undefined;
  const day = typeof value.day === "number" ? value.day : undefined;

  if (!month) return String(year);
  if (!day) return `${year}-${String(month).padStart(2, "0")}`;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
