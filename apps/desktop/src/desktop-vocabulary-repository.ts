import workTypes from "../../../resources/vocabularies/work-types.json";
import type {
  VocabularyDocument,
  VocabularyName,
  VocabularyRepository,
} from "@/domain/repositories/vocabulary-repository";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { localizeText } from "@/application/services/localization-service";

const DOCUMENTS: Partial<Record<VocabularyName, VocabularyDocument>> = {
  "work-types": workTypes as VocabularyDocument,
};

/** Browser-safe vocabulary source for Desktop governance analysis. */
export class DesktopVocabularyRepository implements VocabularyRepository {
  async load(name: VocabularyName): Promise<VocabularyDocument> {
    const document = DOCUMENTS[name];
    if (!document) throw new Error(`Desktop 当前未内嵌词表：${name}`);
    return structuredClone(document);
  }

  async getLabel(name: VocabularyName, id: string, language: SupportedLanguage): Promise<string> {
    const document = await this.load(name);
    const item = document.items.find((candidate) => candidate.id === id);
    return item ? localizeText(item, language, id) : id;
  }
}

export const desktopVocabularyRepository = new DesktopVocabularyRepository();
