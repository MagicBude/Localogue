import type { ImportWarning } from "@/domain/entities/evidence";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

const messages = {
  ja: {
    missing_code: "品番 / 作品コードを認識できませんでした。",
    missing_title: "作品タイトルを認識できませんでした。",
    invalid_duration: "収録時間が有効な正数ではありません。",
    missing_performers: "出演者情報を認識できませんでした。",
    json_row_not_object: "JSON の {detail} 件目はオブジェクトではないためスキップしました。",
    xlsx_fallback_sheet: "「作品」シートがないため、先頭シート「{detail}」を読み込みました。",
  },
  "zh-CN": {
    missing_code: "未识别到番号 / 作品代码。",
    missing_title: "未识别到作品标题。",
    invalid_duration: "时长不是有效的正数。",
    missing_performers: "未识别到演员信息。",
    json_row_not_object: "第 {detail} 条 JSON 不是对象，已跳过。",
    xlsx_fallback_sheet: "未找到“作品”工作表，已读取第一个工作表：{detail}。",
  },
  en: {
    missing_code: "No work code was recognized.",
    missing_title: "No work title was recognized.",
    invalid_duration: "Duration is not a valid positive number.",
    missing_performers: "No performer information was recognized.",
    json_row_not_object: "JSON item {detail} is not an object and was skipped.",
    xlsx_fallback_sheet: 'No "作品" sheet was found; the first sheet "{detail}" was used.',
  },
} as const;

/** Warning 在 Evidence 中保存稳定 code，显示时才按 UI 语言翻译。 */
export function formatImportWarning(
  warning: ImportWarning,
  language: SupportedLanguage,
): string {
  return messages[language][warning.code].replace("{detail}", warning.detail ?? "—");
}
