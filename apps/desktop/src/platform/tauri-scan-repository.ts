import type { Asset } from "../../../../src/domain/entities/asset";
import type { Genre, Tag } from "../../../../src/domain/entities/classification";
import type { MediaFile } from "../../../../src/domain/entities/media-file";
import type { Organization } from "../../../../src/domain/entities/organization";
import type { Person } from "../../../../src/domain/entities/person";
import type { Series } from "../../../../src/domain/entities/series";
import type { Work } from "../../../../src/domain/entities/work";
import type { PersonQuery, PersonSearchResult } from "../../../../src/domain/queries/person-query";
import type { WorkQuery, WorkSearchResult } from "../../../../src/domain/queries/work-query";
import type { LibraryRepository } from "../../../../src/domain/repositories/library-repository";
import { desktopBridge } from "../tauri-bridge";

/**
 * Desktop 扫描专用 Repository Adapter。
 *
 * 它只开放扫描核心实际需要的 works 读取和 media-files 私人层写入。其余治理写入
 * 仍由完整 Web Repository 承担，避免 Webview 获得不必要的通用文件系统权限。
 */
export class TauriScanRepository implements LibraryRepository {
  constructor(private readonly libraryPath: string) {}

  async listWorks(query: WorkQuery = {}): Promise<WorkSearchResult> {
    const works = await desktopBridge.readLibraryCollection<Work>(this.libraryPath, "works");
    const pageSize = query.pageSize ?? 100000;
    const page = query.page ?? 1;
    return { items: works.slice((page - 1) * pageSize, page * pageSize), total: works.length, page, pageSize, facets: emptyFacets() };
  }
  async listMediaFiles(workId?: string): Promise<MediaFile[]> {
    const values = await desktopBridge.readLibraryCollection<MediaFile>(this.libraryPath, "media-files");
    return workId ? values.filter((item) => item.workId === workId) : values;
  }
  saveMediaFile(value: MediaFile): Promise<void> { return desktopBridge.writeLibraryEntity(this.libraryPath, "media-files", value); }
  deleteMediaFile(id: string): Promise<void> { return desktopBridge.deleteLibraryEntity(this.libraryPath, "media-files", id); }
  async findWorkById(id: string): Promise<Work | null> { return (await this.listWorks()).items.find((item) => item.id === id) ?? null; }
  async findWorkByCode(code: string): Promise<Work | null> { return (await this.listWorks()).items.find((item) => item.code.toUpperCase() === code.toUpperCase()) ?? null; }
  async findMediaFileById(id: string): Promise<MediaFile | null> { return (await this.listMediaFiles()).find((item) => item.id === id) ?? null; }

  findPersonById(): Promise<Person | null> { return unsupported(); }
  listPeople(_query?: PersonQuery): Promise<PersonSearchResult> { return unsupported(); }
  findOrganizationById(): Promise<Organization | null> { return unsupported(); }
  listOrganizations(): Promise<Organization[]> { return unsupported(); }
  findSeriesById(): Promise<Series | null> { return unsupported(); }
  listSeries(): Promise<Series[]> { return unsupported(); }
  findAssetById(): Promise<Asset | null> { return unsupported(); }
  listAssets(): Promise<Asset[]> { return unsupported(); }
  listAssetsForSubject(): Promise<Asset[]> { return unsupported(); }
  listGenres(): Promise<Genre[]> { return unsupported(); }
  listTags(): Promise<Tag[]> { return unsupported(); }
  saveWork(): Promise<void> { return unsupported(); }
  savePerson(): Promise<void> { return unsupported(); }
  saveOrganization(): Promise<void> { return unsupported(); }
  saveSeries(): Promise<void> { return unsupported(); }
  saveGenre(): Promise<void> { return unsupported(); }
  saveTag(): Promise<void> { return unsupported(); }
  saveAsset(): Promise<void> { return unsupported(); }
}

function unsupported<T>(): Promise<T> { return Promise.reject(new Error("Desktop Scan Adapter 不开放此治理能力。")); }

function emptyFacets(): WorkSearchResult["facets"] {
  return { makers: [], labels: [], series: [], genres: [], workTypes: [], tags: [], people: [], directors: [], years: [] };
}
