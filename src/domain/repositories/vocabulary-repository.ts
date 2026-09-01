import type {
  LocalizedText,
  SupportedLanguage,
} from "@/domain/value-objects/localized-text";

export type VocabularyItem = LocalizedText & {
  id: string;
  descriptionZh?: string;
};

export interface VocabularyDocument {
  vocabularyVersion: number;
  items: VocabularyItem[];
}

export type VocabularyName =
  | "work-types"
  | "person-statuses"
  | "career-events"
  | "person-name-types"
  | "person-roles"
  | "asset-types"
  | "languages"
  | "built-in-tags"
  | "review-work-statuses"
  | "entity-resolution-statuses"
  | "field-comparison-statuses";

export interface VocabularyRepository {
  load(name: VocabularyName): Promise<VocabularyDocument>;
  getLabel(
    name: VocabularyName,
    id: string,
    language: SupportedLanguage,
  ): Promise<string>;
}
