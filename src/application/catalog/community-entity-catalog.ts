import organizationCatalog from "../../../resources/catalogs/community-organizations.json";
import seriesCatalog from "../../../resources/catalogs/community-series.json";

import type { Organization } from "@/domain/entities/organization";
import type { Series } from "@/domain/entities/series";

/**
 * Community Catalog 是经过 Registry Evidence 人工审核、去重后的只读参考目录。
 *
 * 它不是当前 Library Profile 的 Private / Shared 数据，也不会自动创建作品关系；
 * Desktop Browse 只把它作为“Localogue 已经认识哪些实体”的参考索引。
 */
export type CommunityCatalogNameKind =
  | "source-name"
  | "reviewed-brand-form"
  | "community-translation"
  | "community-transliteration";

export interface CommunityCatalogOrganization extends Organization {
  aliases: string[];
  nameKinds?: Partial<Record<"zh-CN" | "ja" | "en", CommunityCatalogNameKind>>;
  status: "active";
}

export interface CommunityCatalogSeries extends Series {
  aliases: string[];
  nameKinds?: Partial<Record<"zh-CN" | "ja" | "en", CommunityCatalogNameKind>>;
  status: "active";
}

export const COMMUNITY_ORGANIZATION_CATALOG = organizationCatalog.items as CommunityCatalogOrganization[];
export const COMMUNITY_SERIES_CATALOG = seriesCatalog.items as CommunityCatalogSeries[];
