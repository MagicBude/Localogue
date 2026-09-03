export interface NfoFilenameMetadata {
  code?: string;
  releaseDate?: string;
  title?: string;
}

/**
 * 从 NFO 文件名中提取“辅助元数据”。
 *
 * 重要：文件名永远只是 fallback，NFO XML 内明确字段优先。
 * 这个解析器故意只做保守识别，避免把日期、分辨率或普通数字误认成番号。
 */
export function inferNfoFilenameMetadata(fileName: string): NfoFilenameMetadata {
  const stem = stripExtension(fileName.normalize("NFKC").trim());
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

function stripExtension(value: string): string {
  return value.toLowerCase().endsWith(".nfo") ? value.slice(0, -4) : value;
}
