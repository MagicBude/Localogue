import type {
  VocabularyName,
  VocabularyRepository,
} from "@/domain/repositories/vocabulary-repository";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { localizeText } from "@/application/services/localization-service";

/**
 * 一次加载词表并生成 id -> 显示名称映射。
 * 页面只关心“显示什么”，不需要反复理解词表 JSON 的结构。
 */
export async function getVocabularyLabelMap(
  repository: VocabularyRepository,
  name: VocabularyName,
  language: SupportedLanguage,
): Promise<Map<string, string>> {
  const document = await repository.load(name);
  return new Map(
    document.items.map((item) => [
      item.id,
      localizeText(item, language, item.id),
    ]),
  );
}
