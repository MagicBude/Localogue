import type { Work } from "@/domain/entities/work";

export type WorkSort =
  | "release_desc"
  | "release_asc"
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "updated_asc"
  | "code_asc"
  | "code_desc"
  | "title_asc"
  | "title_desc"
  | "duration_asc"
  | "duration_desc";

/** 清晰度来自关联 MediaFile；同一 Work 可以同时命中多个档位。 */
export type MediaResolutionTier = "4k" | "1080p" | "720p" | "sd";

export interface WorkQuery {
  text?: string;
  personIds?: string[];
  directorIds?: string[];
  makerIds?: string[];
  labelIds?: string[];
  seriesIds?: string[];
  genreIds?: string[];
  workTypeIds?: string[];
  tagIds?: string[];
  resolutionTiers?: MediaResolutionTier[];
  releaseYears?: string[];
  releaseFrom?: string;
  releaseTo?: string;
  durationMin?: number;
  durationMax?: number;
  hasMedia?: boolean;
  hasCover?: boolean;
  sort?: WorkSort;
  page?: number;
  pageSize?: number;
}

export interface FacetCount {
  id: string;
  count: number;
}

export interface WorkFacets {
  years: FacetCount[];
  people: FacetCount[];
  directors: FacetCount[];
  makers: FacetCount[];
  labels: FacetCount[];
  series: FacetCount[];
  genres: FacetCount[];
  workTypes: FacetCount[];
  tags: FacetCount[];
  resolutions: FacetCount[];
}

export interface WorkSearchResult {
  items: Work[];
  total: number;
  page: number;
  pageSize: number;
  facets: WorkFacets;
}
