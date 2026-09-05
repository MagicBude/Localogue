import type { LocalizedText } from "@/domain/value-objects/localized-text";

export interface Series {
  schemaVersion: number;
  id: string;
  names: LocalizedText;
  descriptions?: LocalizedText;
  /**
   * 可选归属组织。优先指向已确认的 Label；若来源只能确认 Maker，
   * 可以暂时指向 Maker。没有可靠证据时必须保持 undefined。
   */
  parentOrganizationId?: string;
}
