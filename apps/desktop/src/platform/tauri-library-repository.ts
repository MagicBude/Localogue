import { queryPeople, queryWorks } from "@/application/library/library-query";
import type { Asset } from "@/domain/entities/asset";
import type { Genre, Tag } from "@/domain/entities/classification";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type { PersonQuery, PersonSearchResult } from "@/domain/queries/person-query";
import type { WorkQuery, WorkSearchResult } from "@/domain/queries/work-query";
import type { LibraryRepository } from "@/domain/repositories/library-repository";

import type { DesktopLibraryCollection } from "../contracts";
import { desktopBridge } from "../tauri-bridge";

/**
 * Desktop 的完整“浏览型” LibraryRepository。
 *
 * - Canonical 数据按 private > shared pack 1 > shared pack 2 的顺序合并；
 * - MediaFile 永远只从 private root 读取；
 * - V1-15 只开放 MediaFile 写入，人物/作品治理仍留给后续 parity 阶段；
 * - 查询/排序/Facet 使用与 Web JsonLibraryRepository 完全相同的纯函数核心。
 */
export class TauriLibraryRepository implements LibraryRepository {
  private readonly cache = new Map<DesktopLibraryCollection, Promise<unknown[]>>();

  constructor(
    private readonly readRoots: readonly string[],
    private readonly privateRoot: string | null,
  ) {}

  async findWorkById(id: string): Promise<Work | null> {
    return (await this.readMerged<Work>("works")).find((item) => item.id === id) ?? null;
  }

  async findWorkByCode(code: string): Promise<Work | null> {
    const normalized = code.trim().toUpperCase();
    return (
      (await this.readMerged<Work>("works")).find(
        (item) => item.code.toUpperCase() === normalized,
      ) ?? null
    );
  }

  async listWorks(query: WorkQuery = {}): Promise<WorkSearchResult> {
    const [works, mediaFiles, assets] = await Promise.all([
      this.readMerged<Work>("works"),
      this.listMediaFiles(),
      this.readMerged<Asset>("assets"),
    ]);
    return queryWorks(works, query, mediaFiles, assets);
  }

  async findPersonById(id: string): Promise<Person | null> {
    return (await this.readMerged<Person>("people")).find((item) => item.id === id) ?? null;
  }

  async listPeople(query: PersonQuery = {}): Promise<PersonSearchResult> {
    return queryPeople(await this.readMerged<Person>("people"), query);
  }

  async findOrganizationById(id: string): Promise<Organization | null> {
    return (await this.listOrganizations()).find((item) => item.id === id) ?? null;
  }

  listOrganizations(): Promise<Organization[]> {
    return this.readMerged<Organization>("organizations");
  }

  async findSeriesById(id: string): Promise<Series | null> {
    return (await this.listSeries()).find((item) => item.id === id) ?? null;
  }

  listSeries(): Promise<Series[]> {
    return this.readMerged<Series>("series");
  }

  async findAssetById(id: string): Promise<Asset | null> {
    return (await this.listAssets()).find((item) => item.id === id) ?? null;
  }

  listAssets(): Promise<Asset[]> {
    return this.readMerged<Asset>("assets");
  }

  async listAssetsForSubject(
    subjectType: "person" | "work",
    subjectId: string,
  ): Promise<Asset[]> {
    return (await this.listAssets()).filter(
      (item) => item.subjectType === subjectType && item.subjectId === subjectId,
    );
  }

  async findMediaFileById(id: string): Promise<MediaFile | null> {
    return (await this.listMediaFiles()).find((item) => item.id === id) ?? null;
  }

  async listMediaFiles(workId?: string): Promise<MediaFile[]> {
    if (!this.privateRoot) return [];
    const values = await desktopBridge.readLibraryCollection<MediaFile>(
      this.privateRoot,
      "media-files",
    );
    const filtered = workId ? values.filter((item) => item.workId === workId) : values;
    return [...filtered].sort((a, b) => a.path.localeCompare(b.path, "en"));
  }

  listGenres(): Promise<Genre[]> {
    return this.readMerged<Genre>("genres");
  }

  listTags(): Promise<Tag[]> {
    return this.readMerged<Tag>("tags");
  }

  saveMediaFile(mediaFile: MediaFile): Promise<void> {
    return this.writePrivate("media-files", mediaFile);
  }

  deleteMediaFile(id: string): Promise<void> {
    if (!this.privateRoot) return missingPrivateRoot();
    return desktopBridge.deleteLibraryEntity(this.privateRoot, "media-files", id);
  }

  saveWork(): Promise<void> { return readOnlyGovernance(); }
  savePerson(): Promise<void> { return readOnlyGovernance(); }
  saveOrganization(): Promise<void> { return readOnlyGovernance(); }
  saveSeries(): Promise<void> { return readOnlyGovernance(); }
  saveGenre(): Promise<void> { return readOnlyGovernance(); }
  saveTag(): Promise<void> { return readOnlyGovernance(); }
  saveAsset(): Promise<void> { return readOnlyGovernance(); }

  private async readMerged<T extends { id: string }>(
    collection: Exclude<DesktopLibraryCollection, "media-files">,
  ): Promise<T[]> {
    const cached = this.cache.get(collection);
    if (cached) return (await cached) as T[];

    const request = this.loadMerged<T>(collection);
    this.cache.set(collection, request);
    return request;
  }

  private async loadMerged<T extends { id: string }>(
    collection: Exclude<DesktopLibraryCollection, "media-files">,
  ): Promise<T[]> {
    const merged = new Map<string, T>();
    for (const root of this.readRoots) {
      const values = await desktopBridge.readLibraryCollection<T>(root, collection);
      for (const entity of values) {
        if (entity.id && !merged.has(entity.id)) merged.set(entity.id, entity);
      }
    }
    return [...merged.values()];
  }

  private writePrivate(collection: "media-files", entity: unknown): Promise<void> {
    if (!this.privateRoot) return missingPrivateRoot();
    return desktopBridge.writeLibraryEntity(this.privateRoot, collection, entity);
  }
}

function missingPrivateRoot<T = void>(): Promise<T> {
  return Promise.reject(
    new Error("当前没有配置 Private Library；Shared Pack 是只读基础资料。"),
  );
}

function readOnlyGovernance<T = void>(): Promise<T> {
  return Promise.reject(
    new Error("V1-15 Desktop 先开放完整浏览；Canonical 治理写入将在 V1-16 对齐。"),
  );
}
