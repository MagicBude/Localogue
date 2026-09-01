import type { Person } from "@/domain/entities/person";

export interface PersonQuery {
  text?: string;
  statuses?: string[];
  page?: number;
  pageSize?: number;
}

export interface PersonSearchResult {
  items: Person[];
  total: number;
  page: number;
  pageSize: number;
}
