import type { Person } from "@/domain/entities/person";

export type PersonSort =
  | "name_asc"
  | "name_desc"
  | "birth_asc"
  | "birth_desc"
  | "debut_asc"
  | "debut_desc"
  | "height_asc"
  | "height_desc";

/**
 * 人物库查询条件。
 *
 * V1 仍然使用 JSON 文件，但查询对象从一开始就保持与“数据库查询”类似的形状。
 * 到 V2 切换 SQLite 时，这些字段可以自然映射为 WHERE / ORDER BY 条件。
 */
export interface PersonQuery {
  text?: string;
  statuses?: string[];
  birthYears?: string[];
  debutYears?: string[];
  retirementYears?: string[];
  heightMin?: number;
  heightMax?: number;
  sort?: PersonSort;
  page?: number;
  pageSize?: number;
}

export interface PersonSearchResult {
  items: Person[];
  total: number;
  page: number;
  pageSize: number;
}
