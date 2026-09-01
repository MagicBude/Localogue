import type { Asset } from "@/domain/entities/asset";
import type { Genre, Tag } from "@/domain/entities/classification";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type {
  PersonQuery,
  PersonSearchResult,
} from "@/domain/queries/person-query";
import type { WorkQuery, WorkSearchResult } from "@/domain/queries/work-query";

/**
 * LibraryRepository 是“业务层看见的资料库接口”。
 *
 * 为什么不让页面直接读 JSON？
 * 因为 V2 会换成 SQLite。只要页面依赖这个接口，而不是依赖文件系统，
 * 将来替换为 SqliteLibraryRepository 时，UI 和大部分业务逻辑都无需重写。
 */
export interface LibraryRepository {
  findWorkById(id: string): Promise<Work | null>;
  findWorkByCode(code: string): Promise<Work | null>;
  listWorks(query?: WorkQuery): Promise<WorkSearchResult>;

  findPersonById(id: string): Promise<Person | null>;
  listPeople(query?: PersonQuery): Promise<PersonSearchResult>;

  findOrganizationById(id: string): Promise<Organization | null>;
  listOrganizations(): Promise<Organization[]>;

  findSeriesById(id: string): Promise<Series | null>;
  listSeries(): Promise<Series[]>;

  findAssetById(id: string): Promise<Asset | null>;
  listAssets(): Promise<Asset[]>;

  listGenres(): Promise<Genre[]>;
  listTags(): Promise<Tag[]>;

  saveWork(work: Work): Promise<void>;
  savePerson(person: Person): Promise<void>;
  saveOrganization(organization: Organization): Promise<void>;
  saveSeries(series: Series): Promise<void>;
  saveGenre(genre: Genre): Promise<void>;
  saveTag(tag: Tag): Promise<void>;
}
