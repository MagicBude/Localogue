import { DatabaseSync } from "node:sqlite";

import { queryPeople, queryWorks } from "@/application/library/library-query";
import type { Asset } from "@/domain/entities/asset";
import type { Genre, Tag } from "@/domain/entities/classification";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { PersonQuery, PersonSearchResult } from "@/domain/queries/person-query";
import type { WorkQuery, WorkSearchResult } from "@/domain/queries/work-query";

/**
 * V2 的双数据库 Repository：catalog.db 只读，local.db 承担私人覆盖和本机状态。
 *
 * 当前实现仍复用 queryWorks/queryPeople 纯函数，先证明 JSON 与 SQLite 的查询语义一致；
 * 后续数据规模需要时，再把筛选逐项下推为 SQL，而不改变页面使用的 Repository 接口。
 */
export class SqliteLibraryRepository implements LibraryRepository {
  private readonly catalog: DatabaseSync;
  private readonly local: DatabaseSync;

  constructor(catalogPath: string, localPath: string) {
    this.catalog = new DatabaseSync(catalogPath, { readOnly: true });
    this.local = new DatabaseSync(localPath);
    this.local.exec("PRAGMA foreign_keys = ON");
  }

  async findWorkById(id: string): Promise<Work | null> {
    return (await this.mergedWorks()).find((item) => item.id === id) ?? null;
  }

  async findWorkByCode(code: string): Promise<Work | null> {
    const key = compactWorkCode(code);
    return (await this.mergedWorks()).find((item) => compactWorkCode(item.code) === key) ?? null;
  }

  async listWorks(query: WorkQuery = {}): Promise<WorkSearchResult> {
    const [works, mediaFiles, assets] = await Promise.all([this.mergedWorks(), this.listMediaFiles(), this.listAssets()]);
    const preferences = this.local.prepare("SELECT entity_id, favorite, rating FROM presentation_preferences WHERE entity_type = 'work'").all() as Array<{ entity_id: string; favorite: number | null; rating: number | null }>;
    const favorites = new Set(preferences.filter((item) => item.favorite === 1).map((item) => item.entity_id));
    const ratings = new Map(preferences.filter((item) => item.rating !== null).map((item) => [item.entity_id, Number(item.rating)]));
    return queryWorks(works, query, mediaFiles, assets, favorites, ratings);
  }

  async findPersonById(id: string): Promise<Person | null> {
    return (await this.mergedCollection<Person>("people", "people")).find((item) => item.id === id) ?? null;
  }

  async listPeople(query: PersonQuery = {}): Promise<PersonSearchResult> {
    return queryPeople(await this.mergedCollection<Person>("people", "people"), query);
  }

  async findOrganizationById(id: string): Promise<Organization | null> {
    return (await this.listOrganizations()).find((item) => item.id === id) ?? null;
  }

  async listOrganizations(): Promise<Organization[]> {
    const catalog = this.readCatalogJson<Organization>("organizations");
    const normalized = catalog.map((item) => ({ ...item, parentOrganizationId: item.parentOrganizationId }));
    return mergeById(normalized, this.readPrivate<Organization>("organizations"));
  }

  async findSeriesById(id: string): Promise<Series | null> {
    return (await this.listSeries()).find((item) => item.id === id) ?? null;
  }

  async listSeries(): Promise<Series[]> {
    type CatalogSeries = Series & { makerId?: string; labelId?: string };
    const catalog = this.readCatalogJson<CatalogSeries>("series").map((item) => ({
      ...item,
      parentOrganizationId: item.parentOrganizationId ?? item.labelId ?? item.makerId,
    }));
    return mergeById(catalog, this.readPrivate<Series>("series"));
  }

  async findAssetById(id: string): Promise<Asset | null> {
    return (await this.listAssets()).find((item) => item.id === id) ?? null;
  }

  listAssets(): Promise<Asset[]> {
    return this.mergedCollection<Asset>("assets", "assets");
  }

  async listAssetsForSubject(subjectType: "person" | "work", subjectId: string): Promise<Asset[]> {
    return (await this.listAssets()).filter((item) => item.subjectType === subjectType && item.subjectId === subjectId);
  }

  async findMediaFileById(id: string): Promise<MediaFile | null> {
    return (await this.listMediaFiles()).find((item) => item.id === id) ?? null;
  }

  async listMediaFiles(workId?: string): Promise<MediaFile[]> {
    const items = this.readJsonRows<MediaFile>(this.local, "SELECT json FROM media_files ORDER BY path");
    return workId ? items.filter((item) => item.workId === workId) : items;
  }

  async listGenres(): Promise<Genre[]> {
    const catalogRows = this.catalog.prepare("SELECT id, name_ja, name_zh_cn, name_en FROM genres ORDER BY id").all() as Array<{ id: string; name_ja: string; name_zh_cn: string; name_en: string }>;
    const catalog = catalogRows.map((item) => ({ id: item.id, names: { ja: item.name_ja, "zh-CN": item.name_zh_cn, en: item.name_en } }));
    return mergeById(catalog, this.readPrivate<Genre>("genres"));
  }

  listTags(): Promise<Tag[]> {
    return this.mergedCollection<Tag>("tags", "tags");
  }

  saveWork(work: Work): Promise<void> { return this.savePrivate("works", work, work.code); }
  savePerson(person: Person): Promise<void> { return this.savePrivate("people", person, person.names.find((item) => item.type === "primary")?.value ?? person.names[0]?.value ?? person.id); }
  saveOrganization(item: Organization): Promise<void> { return this.savePrivate("organizations", item, item.names["zh-CN"] ?? item.names.ja ?? item.names.en ?? item.id); }
  saveSeries(item: Series): Promise<void> { return this.savePrivate("series", item, item.names["zh-CN"] ?? item.names.ja ?? item.names.en ?? item.id); }
  saveGenre(item: Genre): Promise<void> { return this.savePrivate("genres", item, item.names["zh-CN"] ?? item.names.ja ?? item.names.en ?? item.id); }
  saveTag(item: Tag): Promise<void> { return this.savePrivate("tags", item, item.names["zh-CN"] ?? item.names.ja ?? item.names.en ?? item.id); }
  saveAsset(item: Asset): Promise<void> { return this.savePrivate("assets", item, item.storagePath); }

  async saveMediaFile(item: MediaFile): Promise<void> {
    this.local.prepare("INSERT INTO media_files (id, path, file_name, work_id, scan_root, match_method, modified_at, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET path=excluded.path, file_name=excluded.file_name, work_id=excluded.work_id, scan_root=excluded.scan_root, match_method=excluded.match_method, modified_at=excluded.modified_at, json=excluded.json").run(item.id, item.path, item.fileName, item.workId ?? null, item.scanRoot ?? null, item.matchMethod ?? null, item.fileModifiedAt ?? item.updatedAt ?? null, JSON.stringify(item));
  }

  async deleteMediaFile(id: string): Promise<void> {
    this.local.prepare("DELETE FROM media_files WHERE id = ?").run(id);
  }

  close(): void {
    this.catalog.close();
    this.local.close();
  }

  private async mergedWorks(): Promise<Work[]> {
    const catalogRows = this.readCatalogJson<Work>("works");
    const genres = relationMap(this.catalog, "SELECT work_id, genre_id AS value FROM work_genres");
    const workTypes = relationMap(this.catalog, "SELECT work_id, work_type_id AS value FROM work_types");
    const catalog = catalogRows.map((work) => ({
      ...work,
      genreIds: genres.get(work.id) ?? [],
      workTypeIds: unique([...(work.workTypeIds ?? []), ...(workTypes.get(work.id) ?? [])]),
    }));
    return mergeById(catalog, this.readPrivate<Work>("works"));
  }

  private async mergedCollection<T extends { id: string }>(catalogTable: string, privateCollection: string): Promise<T[]> {
    return mergeById(this.readCatalogJson<T>(catalogTable), this.readPrivate<T>(privateCollection));
  }

  private readCatalogJson<T>(table: string): T[] {
    return this.readJsonRows<T>(this.catalog, `SELECT json FROM ${table} ORDER BY id`);
  }

  private readPrivate<T>(collection: string): T[] {
    return this.readJsonRows<T>(this.local, "SELECT json FROM private_entities WHERE collection = ? ORDER BY id", collection);
  }

  private readJsonRows<T>(database: DatabaseSync, sql: string, ...params: Array<string | number | null>): T[] {
    const rows = database.prepare(sql).all(...params) as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as T);
  }

  private async savePrivate<T extends { id: string; updatedAt?: string }>(collection: string, entity: T, displayKey: string): Promise<void> {
    this.local.prepare("INSERT INTO private_entities (collection, id, display_key, updated_at, json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET display_key=excluded.display_key, updated_at=excluded.updated_at, json=excluded.json").run(collection, entity.id, displayKey, entity.updatedAt ?? null, JSON.stringify(entity));
  }
}

function relationMap(database: DatabaseSync, sql: string): Map<string, string[]> {
  const rows = database.prepare(sql).all() as Array<{ work_id: string; value: string }>;
  const output = new Map<string, string[]>();
  for (const row of rows) output.set(row.work_id, [...(output.get(row.work_id) ?? []), row.value]);
  return output;
}

function mergeById<T extends { id: string }>(base: T[], overrides: T[]): T[] {
  const result = new Map(base.map((item) => [item.id, item]));
  for (const item of overrides) result.set(item.id, item);
  return [...result.values()];
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
function compactWorkCode(value: string): string { return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/gu, ""); }

