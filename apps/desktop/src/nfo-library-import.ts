import { normalizeNfoCode } from "@/application/importers/nfo-filename-metadata";
import { normalizeIdentityText } from "@/application/review/entity-resolution-service";
import type { Genre, Tag } from "@/domain/entities/classification";
import type { NormalizedImportCandidate } from "@/domain/entities/evidence";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work, WorkPersonRelation } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { PartialDate } from "@/domain/value-objects/partial-date";
import { NfoMetadataImporter } from "@/infrastructure/importers/nfo-importer";

import { desktopBridge } from "./tauri-bridge";

const MAX_NFO_FILES = 10_000;

export type NfoImportItemStatus =
  | "new_work"
  | "existing_work"
  | "missing_code"
  | "missing_title"
  | "duplicate_code"
  | "parse_error";

export interface NfoImportItem {
  path: string;
  fileName: string;
  size: number;
  modifiedAt: string;
  status: NfoImportItemStatus;
  code?: string;
  title?: string;
  normalized?: NormalizedImportCandidate;
  matchedWorkId?: string;
  error?: string;
}

export interface NfoImportGroup {
  key: string;
  code?: string;
  title?: string;
  status: NfoImportItemStatus;
  sourceCount: number;
  representative: NfoImportItem;
  sources: NfoImportItem[];
}

export interface NfoImportPreview {
  roots: string[];
  discovered: number;
  importable: number;
  newWorks: number;
  existingWorks: number;
  skipped: number;
  errors: number;
  items: NfoImportItem[];
  groups: NfoImportGroup[];
}

export interface NfoImportResult {
  imported: number;
  createdWorks: number;
  updatedWorks: number;
  unchangedWorks: number;
  createdPeople: number;
  createdOrganizations: number;
  createdSeries: number;
  createdGenres: number;
  createdTags: number;
  skipped: number;
  warnings: string[];
}

/**
 * NFO 与视频目录完全解耦的批量预览。
 *
 * 这里只扫描 settings.nfoScanPaths 对应的元数据目录，不要求 NFO 与 MediaFile
 * 同名、同目录或一一相邻。真正把媒体绑定到 Work 的仍是既有番号匹配器。
 */
export async function previewNfoImport(
  roots: readonly string[],
  repository: LibraryRepository,
): Promise<NfoImportPreview> {
  const importer = new NfoMetadataImporter();
  const discovered = new Map<string, Awaited<ReturnType<typeof desktopBridge.walkFiles>>[number]>();
  const rootList = unique(roots.map((item) => item.trim()).filter(Boolean));

  for (const root of rootList) {
    const entries = await desktopBridge.walkFiles({
      root,
      extensions: [".nfo"],
      includeHidden: false,
      maxFiles: MAX_NFO_FILES,
    });
    for (const entry of entries) discovered.set(normalizePath(entry.path), entry);
  }

  const parsedItems: NfoImportItem[] = [];
  for (const entry of [...discovered.values()].sort((a, b) => a.path.localeCompare(b.path, "en"))) {
    try {
      const text = await desktopBridge.readNfoText(entry.path);
      const preview = await importer.parse({
        fileName: entry.name,
        bytes: new TextEncoder().encode(text),
      });
      const normalized = preview.candidates[0]?.normalized;
      const code = normalized?.code ? normalizeNfoCode(normalized.code) ?? normalized.code.trim().toUpperCase() : undefined;
      if (normalized && code) normalized.code = code;
      const matched = code ? await repository.findWorkByCode(code) : null;
      const title = normalized?.originalTitle ?? normalized?.title;

      parsedItems.push({
        path: entry.path,
        fileName: entry.name,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        status: !normalized?.code
          ? "missing_code"
          : !matched && !title
            ? "missing_title"
            : matched
              ? "existing_work"
              : "new_work",
        ...(code ? { code } : {}),
        ...(title ? { title } : {}),
        ...(normalized ? { normalized } : {}),
        ...(matched ? { matchedWorkId: matched.id } : {}),
      });
    } catch (error) {
      parsedItems.push({
        path: entry.path,
        fileName: entry.name,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        status: "parse_error",
        error: message(error),
      });
    }
  }

  markDuplicateCodes(parsedItems);
  const importableItems = parsedItems.filter(isImportable);
  const groups = buildGroups(parsedItems);

  return {
    roots: rootList,
    discovered: parsedItems.length,
    importable: importableItems.length,
    newWorks: importableItems.filter((item) => item.status === "new_work").length,
    existingWorks: importableItems.filter((item) => item.status === "existing_work").length,
    skipped: parsedItems.filter((item) => !isImportable(item) && item.status !== "parse_error").length,
    errors: parsedItems.filter((item) => item.status === "parse_error").length,
    items: parsedItems,
    groups,
  };
}

/**
 * 用户明确点击“导入”后才写 Private Canonical Library。
 *
 * 新 Work：创建基础 Canonical + 可精确复用/创建的关系实体。
 * 已有 Work：采用 fill/merge 策略，不覆盖已有标题、日期、简介等人工事实。
 * 这让批量 NFO 适合“给空资料库打底”，也不会静默覆盖后续人工治理结果。
 */
export async function importNfoPreview(
  preview: NfoImportPreview,
  repository: LibraryRepository,
  hashText: (value: string) => string,
): Promise<NfoImportResult> {
  const result: NfoImportResult = {
    imported: 0,
    createdWorks: 0,
    updatedWorks: 0,
    unchangedWorks: 0,
    createdPeople: 0,
    createdOrganizations: 0,
    createdSeries: 0,
    createdGenres: 0,
    createdTags: 0,
    skipped: 0,
    warnings: [],
  };

  const [peopleResult, organizations, series, genres, tags] = await Promise.all([
    repository.listPeople({ page: 1, pageSize: 100_000 }),
    repository.listOrganizations(),
    repository.listSeries(),
    repository.listGenres(),
    repository.listTags(),
  ]);
  const people = peopleResult.items;

  for (const item of preview.items) {
    if (!isImportable(item) || !item.normalized || !item.code) {
      result.skipped += 1;
      continue;
    }

    try {
      const existing = await repository.findWorkByCode(item.code);
      const relations = await resolveRelations(item.normalized, {
        repository,
        people,
        organizations,
        series,
        genres,
        tags,
        hashText,
        result,
      });
      const next = buildWork(existing, item.normalized, item.code, relations, hashText);
      const changed = !existing || stableJson(existing) !== stableJson(next);

      if (changed) await repository.saveWork(next);
      if (!existing) result.createdWorks += 1;
      else if (changed) result.updatedWorks += 1;
      else result.unchangedWorks += 1;
      result.imported += 1;
    } catch (error) {
      result.skipped += 1;
      result.warnings.push(`${item.fileName}: ${message(error)}`);
    }
  }

  return result;
}

interface NfoIngestContext {
  repository: LibraryRepository;
  people: Person[];
  organizations: Organization[];
  series: Series[];
  genres: Genre[];
  tags: Tag[];
  hashText: (value: string) => string;
  result: NfoImportResult;
}

interface ResolvedRelations {
  personRelations: WorkPersonRelation[];
  makerId?: string;
  labelId?: string;
  seriesIds: string[];
  genreIds: string[];
  tagIds: string[];
}

async function resolveRelations(
  candidate: NormalizedImportCandidate,
  context: NfoIngestContext,
): Promise<ResolvedRelations> {
  const performerIds: string[] = [];
  for (const name of candidate.performers) {
    performerIds.push(await findOrCreatePerson(name, context));
  }
  const directorIds: string[] = [];
  for (const name of candidate.directors) {
    directorIds.push(await findOrCreatePerson(name, context));
  }

  const makerId = candidate.maker
    ? await findOrCreateOrganization(candidate.maker, "maker", context)
    : undefined;
  const labelId = candidate.label
    ? await findOrCreateOrganization(candidate.label, "label", context)
    : undefined;

  const seriesIds: string[] = [];
  for (const name of candidate.series) seriesIds.push(await findOrCreateSeries(name, context));
  const genreIds: string[] = [];
  for (const name of candidate.genres) genreIds.push(await findOrCreateGenre(name, context));
  const tagIds: string[] = [];
  for (const name of candidate.tags) tagIds.push(await findOrCreateTag(name, context));

  return {
    personRelations: [
      ...unique(performerIds).map((personId, index) => ({ personId, role: "performer" as const, billingOrder: index + 1 })),
      ...unique(directorIds).map((personId, index) => ({ personId, role: "director" as const, billingOrder: index + 1 })),
    ],
    ...(makerId ? { makerId } : {}),
    ...(labelId ? { labelId } : {}),
    seriesIds: unique(seriesIds),
    genreIds: unique(genreIds),
    tagIds: unique(tagIds),
  };
}

function buildWork(
  existing: Work | null,
  candidate: NormalizedImportCandidate,
  code: string,
  relations: ResolvedRelations,
  hashText: (value: string) => string,
): Work {
  const now = new Date().toISOString();
  if (!existing) {
    const title = candidate.originalTitle ?? candidate.title;
    if (!title) throw new Error("新 Work 缺少标题。文件名只有番号时，需要 NFO XML 内提供 title/originaltitle。");
    return {
      schemaVersion: 1,
      id: stableWorkId(code, hashText),
      code,
      originalLanguage: "ja",
      titles: { ja: title },
      ...(candidate.description ? { descriptions: { ja: candidate.description } } : {}),
      ...(toPartialDate(candidate.releaseDate) ? { releaseDate: toPartialDate(candidate.releaseDate) } : {}),
      ...(candidate.durationMinutes !== undefined ? { durationMinutes: candidate.durationMinutes } : {}),
      workTypeIds: [],
      personRelations: relations.personRelations,
      ...(relations.makerId ? { makerId: relations.makerId } : {}),
      ...(relations.labelId ? { labelId: relations.labelId } : {}),
      seriesIds: relations.seriesIds,
      genreIds: relations.genreIds,
      tagIds: relations.tagIds,
      assetIds: [],
      mediaFileIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  const next: Work = structuredClone(existing);
  const title = candidate.originalTitle ?? candidate.title;
  if (title && !next.titles.ja) next.titles = { ...next.titles, ja: title };
  if (candidate.description && !next.descriptions?.ja) {
    next.descriptions = { ...(next.descriptions ?? {}), ja: candidate.description };
  }
  if (!next.releaseDate) next.releaseDate = toPartialDate(candidate.releaseDate);
  if (next.durationMinutes === undefined && candidate.durationMinutes !== undefined) next.durationMinutes = candidate.durationMinutes;
  next.personRelations = mergeRelations(next.personRelations, relations.personRelations);
  if (!next.makerId && relations.makerId) next.makerId = relations.makerId;
  if (!next.labelId && relations.labelId) next.labelId = relations.labelId;
  next.seriesIds = unique([...next.seriesIds, ...relations.seriesIds]);
  next.genreIds = unique([...next.genreIds, ...relations.genreIds]);
  next.tagIds = unique([...next.tagIds, ...relations.tagIds]);

  if (stableJson(existing) !== stableJson(next)) next.updatedAt = now;
  return next;
}

function mergeRelations(current: WorkPersonRelation[], incoming: WorkPersonRelation[]): WorkPersonRelation[] {
  const result = [...current];
  for (const relation of incoming) {
    if (!result.some((item) => item.personId === relation.personId && item.role === relation.role)) result.push(relation);
  }
  return result;
}

async function findOrCreatePerson(
  name: string,
  context: NfoIngestContext,
): Promise<string> {
  const key = normalizeIdentityText(name);
  const existing = context.people.find((person) => person.names.some((item) => normalizeIdentityText(item.value) === key));
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const person: Person = {
    schemaVersion: 1,
    id: stableNamedId("person", name, context.hashText),
    names: [{ language: "ja", value: name.trim(), type: "primary" }],
    activityStatus: "unknown",
    careerEvents: [],
    galleryAssetIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await context.repository.savePerson(person);
  context.people.push(person);
  context.result.createdPeople += 1;
  return person.id;
}

async function findOrCreateOrganization(
  name: string,
  kind: "maker" | "label",
  context: NfoIngestContext,
): Promise<string> {
  const key = normalizeIdentityText(name);
  const existing = context.organizations.find((item) => item.kind === kind && Object.values(item.names).some((value) => value && normalizeIdentityText(value) === key));
  if (existing) return existing.id;

  const organization: Organization = {
    schemaVersion: 1,
    id: stableNamedId(kind, name, context.hashText),
    kind,
    names: { ja: name.trim() },
  };
  await context.repository.saveOrganization(organization);
  context.organizations.push(organization);
  context.result.createdOrganizations += 1;
  return organization.id;
}

async function findOrCreateSeries(
  name: string,
  context: NfoIngestContext,
): Promise<string> {
  const key = normalizeIdentityText(name);
  const existing = context.series.find((item) => Object.values(item.names).some((value) => value && normalizeIdentityText(value) === key));
  if (existing) return existing.id;

  const entity: Series = { schemaVersion: 1, id: stableNamedId("series", name, context.hashText), names: { ja: name.trim() } };
  await context.repository.saveSeries(entity);
  context.series.push(entity);
  context.result.createdSeries += 1;
  return entity.id;
}

async function findOrCreateGenre(
  name: string,
  context: NfoIngestContext,
): Promise<string> {
  const key = normalizeIdentityText(name);
  const existing = context.genres.find((item) => Object.values(item.names).some((value) => value && normalizeIdentityText(value) === key));
  if (existing) return existing.id;

  const entity: Genre = { id: stableNamedId("genre", name, context.hashText), names: { ja: name.trim() } };
  await context.repository.saveGenre(entity);
  context.genres.push(entity);
  context.result.createdGenres += 1;
  return entity.id;
}

async function findOrCreateTag(
  name: string,
  context: NfoIngestContext,
): Promise<string> {
  const key = normalizeIdentityText(name);
  const existing = context.tags.find((item) => Object.values(item.names).some((value) => value && normalizeIdentityText(value) === key));
  if (existing) return existing.id;

  const entity: Tag = { id: stableNamedId("tag", name, context.hashText), names: { ja: name.trim() }, builtIn: false };
  await context.repository.saveTag(entity);
  context.tags.push(entity);
  context.result.createdTags += 1;
  return entity.id;
}

function buildGroups(items: NfoImportItem[]): NfoImportGroup[] {
  const grouped = new Map<string, NfoImportItem[]>();
  for (const item of items) {
    const key = item.code ? `code:${compactCode(item.code)}` : `path:${normalizePath(item.path)}`;
    const values = grouped.get(key) ?? [];
    values.push(item);
    grouped.set(key, values);
  }

  return [...grouped.entries()].map(([key, sources]) => {
    const representative = sources.find(isImportable)
      ?? sources.find((item) => item.status !== "duplicate_code")
      ?? sources[0];
    return {
      key,
      ...(representative.code ? { code: representative.code } : {}),
      ...(representative.title ? { title: representative.title } : {}),
      status: representative.status,
      sourceCount: sources.length,
      representative,
      sources: [...sources].sort((a, b) => a.fileName.localeCompare(b.fileName, "ja")),
    };
  }).sort((a, b) => (a.code ?? a.representative.fileName).localeCompare(b.code ?? b.representative.fileName, "en"));
}

function markDuplicateCodes(items: NfoImportItem[]): void {
  const groups = new Map<string, NfoImportItem[]>();
  for (const item of items) {
    if (!item.code || item.status === "parse_error" || item.status === "missing_code") continue;
    const key = compactCode(item.code);
    const values = groups.get(key) ?? [];
    values.push(item);
    groups.set(key, values);
  }

  for (const values of groups.values()) {
    if (values.length < 2) continue;
    values.sort((a, b) => qualityScore(b) - qualityScore(a) || b.modifiedAt.localeCompare(a.modifiedAt));
    for (const duplicate of values.slice(1)) duplicate.status = "duplicate_code";
  }
}

function qualityScore(item: NfoImportItem): number {
  const value = item.normalized;
  if (!value) return 0;
  return (value.title || value.originalTitle ? 10 : 0)
    + (value.releaseDate ? 3 : 0)
    + value.performers.length * 2
    + (value.maker ? 2 : 0)
    + value.series.length
    + value.genres.length
    + (value.description ? 2 : 0);
}

function isImportable(item: NfoImportItem): boolean {
  return item.status === "new_work" || item.status === "existing_work";
}

function stableWorkId(code: string, hashText: (value: string) => string): string {
  const slug = code.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug ? `work_${slug}` : `work_${hashText(code).slice(0, 12)}`;
}

function stableNamedId(prefix: string, value: string, hashText: (value: string) => string): string {
  return `${prefix}_nfo_${hashText(`${prefix}|${normalizeIdentityText(value)}`).slice(0, 12)}`;
}

function toPartialDate(value: string | undefined): PartialDate | undefined {
  if (!value) return undefined;
  if (/^\d{4}$/.test(value)) return { value, precision: "year" };
  if (/^\d{4}-\d{2}$/.test(value)) return { value, precision: "month" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { value, precision: "day" };
  return undefined;
}

function compactCode(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const clone = structuredClone(value) as Record<string, unknown>;
  delete clone.updatedAt;
  return JSON.stringify(clone);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
