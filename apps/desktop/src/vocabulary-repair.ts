import {
  controlledGenreDefinition,
  normalizeImportedClassifications,
  workTypeDefinition,
} from "@/application/importers/import-classification-normalizer";
import { normalizeIdentityText } from "@/application/review/entity-resolution-service";
import type { Genre } from "@/domain/entities/classification";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type { LocalizedText } from "@/domain/value-objects/localized-text";

import { TauriLibraryRepository } from "./platform/tauri-library-repository";

const DEPRECATED_GENRE_IDS = new Set(["first_work", "anniversary", "high_definition"]);

export interface VocabularyRepairPreview {
  scannedWorks: number;
  affectedWorks: number;
  movedToSeries: number;
  movedToWorkTypes: number;
  movedToGenres: number;
  removedImportedTags: number;
  removedImportedGenres: number;
  unmappedTerms: string[];
  changes: VocabularyRepairChange[];
}

export interface VocabularyRepairChange {
  workId: string;
  code: string;
  before: { seriesIds: string[]; workTypeIds: string[]; genreIds: string[]; tagIds: string[] };
  after: { seriesNames: string[]; workTypeIds: string[]; genreIds: string[]; preservedTagIds: string[] };
  unmappedTerms: string[];
}

export interface VocabularyRepairResult extends VocabularyRepairPreview {
  updatedWorks: number;
  createdSeries: number;
  createdGenres: number;
  deletedImportedGenres: number;
  deletedImportedTags: number;
}

/**
 * Audit only NFO-generated classification entities.
 *
 * V1-16/17 created imported Genre/Tag IDs with genre_nfo_ / tag_nfo_. That
 * provenance-like ID prefix gives us a safe repair boundary: user-created Tags
 * and Shared Pack controlled entities are never silently reclassified here.
 */
export async function previewVocabularyRepair(repository: TauriLibraryRepository): Promise<VocabularyRepairPreview> {
  const [worksResult, genres, tags, series, peopleResult, organizations] = await Promise.all([
    repository.listWorks({ page: 1, pageSize: 100_000 }),
    repository.listGenres(),
    repository.listTags(),
    repository.listSeries(),
    repository.listPeople({ page: 1, pageSize: 100_000 }),
    repository.listOrganizations(),
  ]);
  const genreMap = new Map(genres.map((item) => [item.id, item]));
  const tagMap = new Map(tags.map((item) => [item.id, item]));
  const seriesMap = new Map(series.map((item) => [item.id, item]));
  const peopleMap = new Map(peopleResult.items.map((item) => [item.id, item]));
  const organizationMap = new Map(organizations.map((item) => [item.id, item]));
  const changes: VocabularyRepairChange[] = [];
  const allUnmapped = new Set<string>();
  let movedToSeries = 0;
  let movedToWorkTypes = 0;
  let movedToGenres = 0;
  let removedImportedTags = 0;
  let removedImportedGenres = 0;

  for (const work of worksResult.items) {
    // Historical repair is intentionally Private-only. A Shared Pack could
    // theoretically contain an ID that resembles our early NFO IDs; never
    // create a Private Override merely because a Shared entity matches the
    // provenance-like prefix.
    if (!(await repository.isPrivateEntity("works", work.id))) continue;

    const importedGenreIds = work.genreIds.filter((id) => id.startsWith("genre_nfo_"));
    const deprecatedGenreIds = work.genreIds.filter((id) => DEPRECATED_GENRE_IDS.has(id));
    const removableGenreIds = unique([...importedGenreIds, ...deprecatedGenreIds]);
    const importedTagIds = work.tagIds.filter((id) => id.startsWith("tag_nfo_"));
    if (!removableGenreIds.length && !importedTagIds.length) continue;

    const rawGenreTerms = importedGenreIds.map((id) => entityName(genreMap.get(id))).filter(Boolean) as string[];
    const rawTagTerms = importedTagIds.map((id) => entityName(tagMap.get(id))).filter(Boolean) as string[];
    const performerNames = work.personRelations
      .filter((relation) => relation.role === "performer")
      .map((relation) => personName(peopleMap.get(relation.personId)))
      .filter(Boolean) as string[];
    const directorNames = work.personRelations
      .filter((relation) => relation.role === "director")
      .map((relation) => personName(peopleMap.get(relation.personId)))
      .filter(Boolean) as string[];
    const maker = work.makerId ? entityName(organizationMap.get(work.makerId)) : undefined;
    const label = work.labelId ? entityName(organizationMap.get(work.labelId)) : undefined;
    const existingSeriesNames = work.seriesIds.map((id) => entityName(seriesMap.get(id))).filter(Boolean) as string[];

    const normalized = normalizeImportedClassifications({
      code: work.code,
      performers: performerNames,
      directors: directorNames,
      ...(maker ? { maker } : {}),
      ...(label ? { label } : {}),
      series: existingSeriesNames,
      genres: rawGenreTerms,
      tags: rawTagTerms,
      workTypes: work.workTypeIds,
    });
    normalized.unmappedTerms.forEach((term) => allUnmapped.add(term));

    const preservedGenreIds = work.genreIds.filter((id) => !id.startsWith("genre_nfo_") && !DEPRECATED_GENRE_IDS.has(id));
    const preservedTagIds = work.tagIds.filter((id) => !id.startsWith("tag_nfo_"));
    const normalizedGenreIds = normalized.candidate.genres
      .map((value) => controlledGenreDefinition(value)?.id)
      .filter((value): value is string => Boolean(value));
    const normalizedWorkTypes = normalized.candidate.workTypes
      .map((value) => workTypeDefinition(value)?.id)
      .filter((value): value is string => Boolean(value));

    const newSeriesNames = normalized.candidate.series.filter((name) => !existingSeriesNames.some((existing) => same(existing, name)));
    const addedWorkTypes = normalizedWorkTypes.filter((id) => !work.workTypeIds.includes(id));
    const addedGenres = normalizedGenreIds.filter((id) => !preservedGenreIds.includes(id));

    removedImportedGenres += removableGenreIds.length;
    removedImportedTags += importedTagIds.length;
    movedToSeries += newSeriesNames.length;
    movedToWorkTypes += addedWorkTypes.length;
    movedToGenres += addedGenres.length;

    changes.push({
      workId: work.id,
      code: work.code,
      before: { seriesIds: work.seriesIds, workTypeIds: work.workTypeIds, genreIds: work.genreIds, tagIds: work.tagIds },
      after: {
        seriesNames: normalized.candidate.series,
        workTypeIds: unique([...work.workTypeIds, ...normalizedWorkTypes]),
        genreIds: unique([...preservedGenreIds, ...normalizedGenreIds]),
        preservedTagIds,
      },
      unmappedTerms: normalized.unmappedTerms,
    });
  }

  return {
    scannedWorks: worksResult.total,
    affectedWorks: changes.length,
    movedToSeries,
    movedToWorkTypes,
    movedToGenres,
    removedImportedTags,
    removedImportedGenres,
    unmappedTerms: [...allUnmapped].sort((a, b) => a.localeCompare(b, "ja")),
    changes,
  };
}

export async function applyVocabularyRepair(
  repository: TauriLibraryRepository,
  preview: VocabularyRepairPreview,
  hashText: (value: string) => string,
): Promise<VocabularyRepairResult> {
  const [series, genres] = await Promise.all([repository.listSeries(), repository.listGenres()]);
  let createdSeries = 0;
  let createdGenres = 0;
  let updatedWorks = 0;
  let deletedImportedGenres = 0;
  let deletedImportedTags = 0;

  for (const change of preview.changes) {
    const work = await repository.findWorkById(change.workId);
    if (!work) continue;

    const seriesIds: string[] = [];
    for (const name of change.after.seriesNames) {
      let entity = series.find((item) => Object.values(item.names).some((value) => value && same(value, name)));
      if (!entity) {
        entity = { schemaVersion: 1, id: `series_nfo_${hashText(`series|${normalizeIdentityText(name)}`).slice(0, 12)}`, names: { ja: name } };
        await repository.saveSeries(entity);
        series.push(entity);
        createdSeries += 1;
      }
      seriesIds.push(entity.id);
    }

    const genreIds = [...change.after.genreIds];
    for (const id of change.after.genreIds) {
      const definition = controlledGenreDefinition(id);
      if (!definition || genres.some((item) => item.id === definition.id)) continue;
      const entity: Genre = { id: definition.id, names: { ...definition.names } };
      await repository.saveGenre(entity);
      genres.push(entity);
      createdGenres += 1;
    }

    const next: Work = {
      ...work,
      seriesIds: unique(seriesIds),
      workTypeIds: unique(change.after.workTypeIds),
      genreIds: unique(genreIds),
      tagIds: unique(change.after.preservedTagIds),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveWork(next);
    updatedWorks += 1;
  }

  const importedGenreIds = unique(preview.changes.flatMap((change) => change.before.genreIds.filter((id) => id.startsWith("genre_nfo_") || DEPRECATED_GENRE_IDS.has(id))));
  const importedTagIds = unique(preview.changes.flatMap((change) => change.before.tagIds.filter((id) => id.startsWith("tag_nfo_"))));
  for (const id of importedGenreIds) {
    try { await repository.deletePrivateGenre(id); deletedImportedGenres += 1; } catch { /* still referenced or not private: keep safely */ }
  }
  for (const id of importedTagIds) {
    try { await repository.deletePrivateTag(id); deletedImportedTags += 1; } catch { /* still referenced or not private: keep safely */ }
  }

  return { ...preview, updatedWorks, createdSeries, createdGenres, deletedImportedGenres, deletedImportedTags };
}

function entityName(entity: { names: LocalizedText } | undefined): string | undefined {
  if (!entity) return undefined;
  return entity.names.ja ?? entity.names["zh-CN"] ?? entity.names.en ?? Object.values(entity.names).find(Boolean);
}

function personName(person: Person | undefined): string | undefined {
  if (!person) return undefined;
  return person.names.find((item) => item.type === "primary" && item.language === "ja")?.value
    ?? person.names.find((item) => item.type === "primary")?.value
    ?? person.names[0]?.value;
}

function same(a: string, b: string): boolean {
  return normalizeIdentityText(a) === normalizeIdentityText(b);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
