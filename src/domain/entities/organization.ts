import type { LocalizedText } from "@/domain/value-objects/localized-text";

export type OrganizationKind = "maker" | "label" | "agency" | "other";

export interface Organization {
  schemaVersion: number;
  id: string;
  kind: OrganizationKind;
  names: LocalizedText;
  descriptions?: LocalizedText;
  parentOrganizationId?: string;
  logoAssetId?: string;
}
