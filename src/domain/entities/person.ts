import type {
  LocalizedText,
  SupportedLanguage,
} from "@/domain/value-objects/localized-text";
import type { PartialDate } from "@/domain/value-objects/partial-date";

export type PersonActivityStatus =
  | "active"
  | "retired"
  | "hiatus"
  | "inactive"
  | "unknown";

export type PersonNameType =
  | "primary"
  | "localized"
  | "romanized"
  | "alias"
  | "former_name"
  | "stage_name"
  | "alternate";

export type CareerEventType =
  | "debut"
  | "retirement"
  | "return"
  | "hiatus_start"
  | "hiatus_end"
  | "name_change"
  | "other";

export interface PersonName {
  language: SupportedLanguage;
  value: string;
  type: PersonNameType;
  validFrom?: string;
  validTo?: string;
}

export interface CareerEvent {
  type: CareerEventType;
  date?: PartialDate;
  note?: string;
}

export interface BodyMeasurements {
  bustCm?: number;
  waistCm?: number;
  hipCm?: number;
  cup?: string;
}

/**
 * Person 是统一人物实体。
 *
 * “演员”和“导演”不分别建立两套人物表；角色由 WorkPersonRelation 区分。
 * 这样同一个人未来即使拥有多个职业角色，也不会产生重复实体。
 */
export interface Person {
  schemaVersion: number;
  id: string;
  names: PersonName[];
  activityStatus: PersonActivityStatus;
  careerEvents: CareerEvent[];
  birthDate?: PartialDate;
  birthPlace?: LocalizedText;
  heightCm?: number;
  measurements?: BodyMeasurements;
  biographies?: LocalizedText;
  organizationRelations?: Array<{
    organizationId: string;
    validFrom?: string;
    validTo?: string;
  }>;
  portraitAssetId?: string;
  galleryAssetIds: string[];
  createdAt?: string;
  updatedAt?: string;
}
