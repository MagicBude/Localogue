import path from "node:path";

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
import { queryPeople, queryWorks } from "@/application/library/library-query";
import { JsonFileStore, type JsonStoreRoots } from "@/infrastructure/repositories/json-file-store";

/**
 * V1 的文件化 Repository。
 *
 * 重要：上层只依赖 LibraryRepository 接口。
 * 未来 V2 的 SqliteLibraryRepository 会实现同一个接口，页面不需要知道数据源已经改变。
 */
export class JsonLibraryRepository implements LibraryRepository {
  private readonly store: JsonFileStore;

  constructor(
    readRoots: JsonStoreRoots = path.join(process.cwd(), "data", "library"),
    private readonly writableRoot: string | (() => string | null) = path.join(process.cwd(), "data", "library"),
  ) {
    this.store = new JsonFileStore(readRoots);
  }

  async findWorkById(id: string): Promise<Work | null> {
    const works = await this.store.readCollection<Work>("works");
    return works.find((work) => work.id === id) ?? null;
  }

  async findWorkByCode(code: string): Promise<Work | null> {
    const normalized = compactWorkCode(code);
    const works = await this.store.readCollection<Work>("works");
    return works.find((work) => compactWorkCode(work.code) === normalized) ?? null;
  }

  async listWorks(query: WorkQuery = {}): Promise<WorkSearchResult> {
    const [works, mediaFiles, assets] = await Promise.all([
      this.store.readCollection<Work>("works"),
      this.listMediaFiles(),
      this.store.readCollection<Asset>("assets"),
    ]);
    return queryWorks(works, query, mediaFiles, assets);
  }

  async findPersonById(id: string): Promise<Person | null> {
    const people = await this.store.readCollection<Person>("people");
    return people.find((person) => person.id === id) ?? null;
  }

  async listPeople(query: PersonQuery = {}): Promise<PersonSearchResult> {
    const people = await this.store.readCollection<Person>("people");
    return queryPeople(people, query);
  }

  async findOrganizationById(id: string): Promise<Organization | null> {
    const organizations = await this.listOrganizations();
    return organizations.find((item) => item.id === id) ?? null;
  }

  listOrganizations(): Promise<Organization[]> {
    return this.store.readCollection<Organization>("organizations");
  }

  async findSeriesById(id: string): Promise<Series | null> {
    const series = await this.listSeries();
    return series.find((item) => item.id === id) ?? null;
  }

  listSeries(): Promise<Series[]> {
    return this.store.readCollection<Series>("series");
  }

  async findAssetById(id: string): Promise<Asset | null> {
    const assets = await this.listAssets();
    return assets.find((item) => item.id === id) ?? null;
  }

  listAssets(): Promise<Asset[]> {
    return this.store.readCollection<Asset>("assets");
  }

  async listAssetsForSubject(subjectType: "person" | "work", subjectId: string): Promise<Asset[]> {
    const assets = await this.listAssets();
    return assets.filter((item) => item.subjectType === subjectType && item.subjectId === subjectId);
  }

  async findMediaFileById(id: string): Promise<MediaFile | null> {
    const mediaFiles = await this.listMediaFiles();
    return mediaFiles.find((item) => item.id === id) ?? null;
  }

  async listMediaFiles(workId?: string): Promise<MediaFile[]> {
    // MediaFile 是本机/私人状态，Shared Pack 中即使意外出现 media-files/ 也绝不能读取。
    const root = this.resolveWritableRoot();
    if (!root) return [];
    const mediaFiles = await new JsonFileStore(root).readCollection<MediaFile>("media-files");
    const filtered = workId ? mediaFiles.filter((item) => item.workId === workId) : mediaFiles;
    return [...filtered].sort((a, b) => a.path.localeCompare(b.path, "en"));
  }

  listGenres(): Promise<Genre[]> {
    return this.store.readCollection<Genre>("genres");
  }

  listTags(): Promise<Tag[]> {
    return this.store.readCollection<Tag>("tags");
  }

  saveWork(work: Work): Promise<void> {
    return this.writer().writeEntity("works", work);
  }

  savePerson(person: Person): Promise<void> {
    return this.writer().writeEntity("people", person);
  }

  saveOrganization(organization: Organization): Promise<void> {
    return this.writer().writeEntity("organizations", organization);
  }

  saveSeries(series: Series): Promise<void> {
    return this.writer().writeEntity("series", series);
  }

  saveGenre(genre: Genre): Promise<void> {
    return this.writer().writeEntity("genres", genre);
  }

  saveTag(tag: Tag): Promise<void> {
    return this.writer().writeEntity("tags", tag);
  }

  saveAsset(asset: Asset): Promise<void> {
    return this.writer().writeEntity("assets", asset);
  }

  saveMediaFile(mediaFile: MediaFile): Promise<void> {
    return this.writer().writeEntity("media-files", mediaFile);
  }

  deleteMediaFile(id: string): Promise<void> {
    return this.writer().deleteEntity("media-files", id);
  }

  private writer(): JsonFileStore {
    const root = this.resolveWritableRoot();
    if (!root) {
      throw new Error("当前没有配置可写私人资料库；Shared Pack 与 Demo Library 都是只读的。");
    }
    return new JsonFileStore(root);
  }

  private resolveWritableRoot(): string | null {
    const root = typeof this.writableRoot === "function" ? this.writableRoot() : this.writableRoot;
    return root || null;
  }
}


function compactWorkCode(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
