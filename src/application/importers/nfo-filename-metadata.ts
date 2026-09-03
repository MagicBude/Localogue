export interface NfoFilenameMetadata {
  code?: string;
  releaseDate?: string;
  title?: string;
}

/**
 * 从任意本地资料文件名中提取“辅助元数据”。
 *
 * V1-17 把 NFO、poster、fanart、thumb 等都视为同一资料源中的不同文件类型，
 * 因此番号/日期/标题的文件名推断必须共用同一套保守规则。
 */
export function inferCatalogFilenameMetadata(fileName: string): NfoFilenameMetadata {
  const stem = stripLastExtension(fileName.normalize("NFKC").trim());
  if (!stem) return {};

  const codeMatch = findCode(stem);
  const dateMatch = findDate(stem);
  const title = cleanTitle(stem, codeMatch?.raw, dateMatch?.raw);

  return {
    ...(codeMatch ? { code: codeMatch.code } : {}),
    ...(dateMatch ? { releaseDate: dateMatch.date } : {}),
    ...(title ? { title } : {}),
  };
}

/**
 * 兼容既有 NFO Importer 的命名入口。
 * XML 内明确字段仍然优先，文件名永远只是 fallback。
 */
export function inferNfoFilenameMetadata(fileName: string): NfoFilenameMetadata {
  return inferCatalogFilenameMetadata(fileName);
}

interface CodeMatch {
  raw: string;
  code: string;
}

interface DateMatch {
  raw: string;
  date: string;
}

function findCode(value: string): CodeMatch | undefined {
  // 常见番号：SONE-123 / ABW001 / 300MIUM-123 / FC2-PPV-1234567。
  // 普通番号前缀必须至少包含一个字母，因此不会把 2026-08-01 误认成番号。
  const patterns = [
    /(?:^|[^A-Z0-9])((?:FC2[-_. ]?PPV)[-_. ]?\d{4,8})(?=$|[^A-Z0-9])/iu,
    /(?:^|[^A-Z0-9])((?=[A-Z0-9]{2,12}(?:[-_. ][A-Z]{1,6})?[-_. ]\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,12}(?:[-_. ][A-Z]{1,6})?[-_. ]\d{2,7})(?=$|[^A-Z0-9])/iu,
    /(?:^|[^A-Z0-9])([A-Z0-9]{1,11}[A-Z]\d{2,7})(?=$|[^A-Z0-9])/iu,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match?.[1]) continue;
    const raw = match[1];
    const code = normalizeNfoCode(raw);
    if (code) return { raw, code };
  }
  return undefined;
}

export function normalizeNfoCode(value: string): string | undefined {
  const normalized = value
    .normalize("NFKC")
    .toUpperCase()
    .trim()
    .replace(/[_.\s]+/g, "-")
    .replace(/-+/g, "-");

  const fc2 = normalized.match(/^FC2-?PPV-?(\d{4,8})$/);
  if (fc2) return `FC2-PPV-${fc2[1]}`;

  const separated = normalized.match(/^((?=[A-Z0-9-]*[A-Z])[A-Z0-9]{2,12}(?:-[A-Z]{1,6})?)-(\d{2,7})$/);
  if (separated) return `${separated[1]}-${separated[2]}`;

  // 没有分隔符时，最后一个字母之后的连续数字作为番号数字部分。
  // 例如 ABW001 -> ABW-001，300MIUM123 -> 300MIUM-123。
  const compact = normalized.replace(/-/g, "");
  const unseparated = compact.match(/^([A-Z0-9]{1,11}[A-Z])(\d{2,7})$/);
  if (unseparated) return `${unseparated[1]}-${unseparated[2]}`;
  return undefined;
}

function findDate(value: string): DateMatch | undefined {
  const separated = value.match(/(?:^|[^0-9])((20\d{2}|19\d{2})[-_.年](\d{1,2})[-_.月](\d{1,2})日?)(?=$|[^0-9])/u);
  if (separated) {
    const [, raw, year, month, day] = separated;
    if (validDateParts(year, month, day)) {
      return { raw, date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` };
    }
  }

  const compact = value.match(/(?:^|[^0-9])((20\d{2}|19\d{2})(\d{2})(\d{2}))(?=$|[^0-9])/u);
  if (compact) {
    const [, raw, year, month, day] = compact;
    if (validDateParts(year, month, day)) {
      return { raw, date: `${year}-${month}-${day}` };
    }
  }
  return undefined;
}

function validDateParts(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function cleanTitle(stem: string, codeRaw?: string, dateRaw?: string): string | undefined {
  let value = stem;
  for (const token of [codeRaw, dateRaw]) {
    if (!token) continue;
    value = value.replace(token, " ");
  }

  value = value
    // Local Asset 的角色后缀不是片名的一部分。
    .replace(/(?:[-_.\s])(fanart|poster|thumb|thumbnail|cover|background|backdrop|screenshot|clearlogo|logo)(?:[-_.\s]?\d+)?$/iu, " ")
    // 多分段 NFO：part1 / cd1 不应成为作品标题。
    .replace(/(?:[-_.\s])(part|cd|disc|disk)[-_.\s]?\d+$/iu, " ")
    .replace(/[\[\]【】()（）]/g, " ")
    .replace(/(?:^|[\s._-])(1080p|2160p|4k|uhd|fhd|hevc|x265|x264)(?=$|[\s._-])/giu, " ")
    .replace(/[._]+/g, " ")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 只有番号 / 日期的文件名不应伪造标题。
  if (!value || /^[-–—]+$/.test(value)) return undefined;
  return value;
}

function stripLastExtension(value: string): string {
  const lastSlash = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
  const lastDot = value.lastIndexOf(".");
  return lastDot > lastSlash ? value.slice(0, lastDot) : value;
}
