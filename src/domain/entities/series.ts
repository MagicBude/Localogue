import type { LocalizedText } from "@/domain/value-objects/localized-text";

export interface Series {
  schemaVersion: number;
  id: string;
  names: LocalizedText;
  descriptions?: LocalizedText;
}
