import workTypes from "../../../resources/vocabularies/work-types.json";
import personStatuses from "../../../resources/vocabularies/person-statuses.json";
import careerEvents from "../../../resources/vocabularies/career-events.json";
import personNameTypes from "../../../resources/vocabularies/person-name-types.json";
import personRoles from "../../../resources/vocabularies/person-roles.json";
import assetTypes from "../../../resources/vocabularies/asset-types.json";
import languages from "../../../resources/vocabularies/languages.json";
import builtInTags from "../../../resources/vocabularies/built-in-tags.json";
import reviewWorkStatuses from "../../../resources/vocabularies/review-work-statuses.json";
import entityResolutionStatuses from "../../../resources/vocabularies/entity-resolution-statuses.json";
import fieldComparisonStatuses from "../../../resources/vocabularies/field-comparison-statuses.json";
import completenessLevels from "../../../resources/vocabularies/completeness-levels.json";
import duplicateConfidenceLevels from "../../../resources/vocabularies/duplicate-confidence-levels.json";

import type {
  VocabularyDocument,
  VocabularyName,
  VocabularyRepository,
} from "@/domain/repositories/vocabulary-repository";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { localizeText } from "@/application/services/localization-service";

const documents: Record<VocabularyName, VocabularyDocument> = {
  "work-types": workTypes as VocabularyDocument,
  "person-statuses": personStatuses as VocabularyDocument,
  "career-events": careerEvents as VocabularyDocument,
  "person-name-types": personNameTypes as VocabularyDocument,
  "person-roles": personRoles as VocabularyDocument,
  "asset-types": assetTypes as VocabularyDocument,
  languages: languages as VocabularyDocument,
  "built-in-tags": builtInTags as VocabularyDocument,
  "review-work-statuses": reviewWorkStatuses as VocabularyDocument,
  "entity-resolution-statuses": entityResolutionStatuses as VocabularyDocument,
  "field-comparison-statuses": fieldComparisonStatuses as VocabularyDocument,
  "completeness-levels": completenessLevels as VocabularyDocument,
  "duplicate-confidence-levels": duplicateConfidenceLevels as VocabularyDocument,
};

/** Desktop WebView 使用打包进应用的只读 Vocabulary，不访问 Node fs。 */
export class DesktopVocabularyRepository implements VocabularyRepository {
  async load(name: VocabularyName): Promise<VocabularyDocument> {
    return documents[name];
  }

  async getLabel(name: VocabularyName, id: string, language: SupportedLanguage): Promise<string> {
    const item = documents[name].items.find((entry) => entry.id === id);
    return item ? localizeText(item, language, id) : id;
  }
}

export const desktopVocabularyRepository = new DesktopVocabularyRepository();
