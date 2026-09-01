import type { EvidenceRecord, NormalizedImportCandidate } from "@/domain/entities/evidence";
import type { Genre, Tag } from "@/domain/entities/classification";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type {
  EntityResolution,
  EntityResolutionCandidate,
  EvidenceReviewAnalysis,
  ReviewFieldComparison,
  ReviewFieldValue,
} from "@/domain/entities/review";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type {
  VocabularyDocument,
  VocabularyRepository,
} from "@/domain/repositories/vocabulary-repository";
import { localizeText } from "@/application/services/localization-service";

interface ReviewContext {
  people: Person[];
  organizations: Organization[];
  series: Series[];
  genres: Genre[];
  tags: Tag[];
  workTypes: VocabularyDocument;
}

/**
 * 为一批 Evidence 只加载一次资料库索引。
 *
 * V1 使用 JSON 文件，数据量还不大，但也不应该为 Inbox 中的每一条 Evidence
 * 重复扫描所有 people / organizations / genres。到了 V2 SQLite，这里的“上下文”
 * 会自然演化成数据库查询和索引，而 Review 页面无需改变语义。
 */
export async function analyzeEvidenceRecords(
  records: EvidenceRecord[],
  library: LibraryRepository,
  vocabularies: VocabularyRepository,
): Promise<EvidenceReviewAnalysis[]> {
  const context = await buildReviewContext(library, vocabularies);
  return Promise.all(records.map((record) => analyzeEvidenceRecord(record, library, context)));
}

export async function analyzeSingleEvidenceRecord(
  record: EvidenceRecord,
  library: LibraryRepository,
  vocabularies: VocabularyRepository,
): Promise<EvidenceReviewAnalysis> {
  const context = await buildReviewContext(library, vocabularies);
  return analyzeEvidenceRecord(record, library, context);
}

async function buildReviewContext(
  library: LibraryRepository,
  vocabularies: VocabularyRepository,
): Promise<ReviewContext> {
  const [peopleResult, organizations, series, genres, tags, workTypes] = await Promise.all([
    library.listPeople({ page: 1, pageSize: 100_000 }),
    library.listOrganizations(),
    library.listSeries(),
    library.listGenres(),
    library.listTags(),
    vocabularies.load("work-types"),
  ]);

  return {
    people: peopleResult.items,
    organizations,
    series,
    genres,
    tags,
    workTypes,
  };
}

async function analyzeEvidenceRecord(
  record: EvidenceRecord,
  library: LibraryRepository,
  context: ReviewContext,
): Promise<EvidenceReviewAnalysis> {
  const normalized = record.normalized;
  const matchedWork = normalized.code
    ? await library.findWorkByCode(normalized.code)
    : null;

  const performers = normalized.performers.map((value) => resolvePerson(value, context.people));
  const directors = normalized.directors.map((value) => resolvePerson(value, context.people));
  const maker = normalized.maker
    ? resolveOrganization(normalized.maker, "maker", context.organizations)
    : undefined;
  const label = normalized.label
    ? resolveOrganization(normalized.label, "label", context.organizations)
    : undefined;
  const series = normalized.series.map((value) => resolveNamedEntity(value, context.series));
  const genres = normalized.genres.map((value) => resolveNamedEntity(value, context.genres));
  const tags = normalized.tags.map((value) => resolveNamedEntity(value, context.tags));
  const workTypes = normalized.workTypes.map((value) => resolveVocabularyItem(value, context.workTypes));

  const comparisons = matchedWork
    ? compareWithExistingWork(matchedWork, normalized, {
        performers,
        directors,
        maker,
        label,
        series,
        genres,
        tags,
        workTypes,
        context,
      })
    : [];

  const entityResolutions = [
    ...performers,
    ...directors,
    ...(maker ? [maker] : []),
    ...(label ? [label] : []),
    ...series,
    ...genres,
    ...tags,
    ...workTypes,
  ];

  const conflictingFields = comparisons.filter((item) => item.status !== "same").length;
  const hasEntityProblem = entityResolutions.some((item) =>
    ["ambiguous", "unresolved"].includes(item.status),
  );

  return {
    evidenceId: record.id,
    sourceName: record.sourceName,
    sourceType: record.sourceType,
    importedAt: record.importedAt,
    code: normalized.code,
    title: normalized.title ?? normalized.originalTitle,
    workStatus: !normalized.code
      ? "missing_code"
      : !matchedWork
        ? "new_work"
        : conflictingFields > 0 || hasEntityProblem
          ? "existing_conflict"
          : "existing_clean",
    matchedWorkId: matchedWork?.id,
    warnings: record.warnings,
    comparisons,
    performers,
    directors,
    maker,
    label,
    series,
    genres,
    tags,
    workTypes,
    summary: {
      matchedEntities: entityResolutions.filter((item) => item.status === "matched").length,
      newEntities: entityResolutions.filter((item) => item.status === "new").length,
      ambiguousEntities: entityResolutions.filter((item) => item.status === "ambiguous").length,
      unresolvedEntities: entityResolutions.filter((item) => item.status === "unresolved").length,
      conflictingFields,
    },
  };
}

function resolvePerson(value: string, people: Person[]): EntityResolution {
  const key = normalizeIdentityText(value);
  const matches = people.filter((person) =>
    person.names.some((name) => normalizeIdentityText(name.value) === key),
  );

  return toResolution(
    value,
    matches.map((person) => ({
      id: person.id,
      label: getJapaneseOrFirstPersonName(person),
    })),
  );
}

function resolveOrganization(
  value: string,
  kind: Organization["kind"],
  organizations: Organization[],
): EntityResolution {
  const matches = organizations
    .filter((organization) => organization.kind === kind)
    .filter((organization) => localizedTextMatches(organization.names, value))
    .map((organization) => ({
      id: organization.id,
      label: localizeText(organization.names, "ja", organization.id),
    }));

  return toResolution(value, matches);
}

function resolveNamedEntity(
  value: string,
  items: Array<Genre | Tag | Series>,
): EntityResolution {
  const matches = items
    .filter((item) => localizedTextMatches(item.names, value) || normalizeIdentityText(item.id) === normalizeIdentityText(value))
    .map((item) => ({
      id: item.id,
      label: localizeText(item.names, "ja", item.id),
    }));

  return toResolution(value, matches);
}

function resolveVocabularyItem(value: string, vocabulary: VocabularyDocument): EntityResolution {
  const matches = vocabulary.items
    .filter((item) =>
      normalizeIdentityText(item.id) === normalizeIdentityText(value) ||
      localizedTextMatches(item, value),
    )
    .map((item) => ({
      id: item.id,
      label: localizeText(item, "ja", item.id),
    }));

  return toResolution(value, matches);
}

function toResolution(
  sourceValue: string,
  matches: EntityResolutionCandidate[],
): EntityResolution {
  if (matches.length === 1) {
    return {
      sourceValue,
      status: "matched",
      matchedId: matches[0].id,
      matchedLabel: matches[0].label,
      candidates: matches,
    };
  }

  if (matches.length > 1) {
    return {
      sourceValue,
      status: "ambiguous",
      candidates: matches,
    };
  }

  // V1-05 对“有值但资料库不存在”的情况统一叫 new。
  // unresolved 预留给未来“值本身无法解释/不完整”的场景。
  return {
    sourceValue,
    status: "new",
    candidates: [],
  };
}

function compareWithExistingWork(
  work: Work,
  evidence: NormalizedImportCandidate,
  resolved: {
    performers: EntityResolution[];
    directors: EntityResolution[];
    maker?: EntityResolution;
    label?: EntityResolution;
    series: EntityResolution[];
    genres: EntityResolution[];
    tags: EntityResolution[];
    workTypes: EntityResolution[];
    context: ReviewContext;
  },
): ReviewFieldComparison[] {
  const peopleLabel = new Map(
    resolved.context.people.map((person) => [person.id, getJapaneseOrFirstPersonName(person)]),
  );
  const organizationLabel = new Map(
    resolved.context.organizations.map((item) => [item.id, localizeText(item.names, "ja", item.id)]),
  );
  const seriesLabel = new Map(
    resolved.context.series.map((item) => [item.id, localizeText(item.names, "ja", item.id)]),
  );
  const genreLabel = new Map(
    resolved.context.genres.map((item) => [item.id, localizeText(item.names, "ja", item.id)]),
  );
  const tagLabel = new Map(
    resolved.context.tags.map((item) => [item.id, localizeText(item.names, "ja", item.id)]),
  );
  const workTypeLabel = new Map(
    resolved.context.workTypes.items.map((item) => [item.id, localizeText(item, "ja", item.id)]),
  );

  const workPerformers = work.personRelations
    .filter((item) => item.role === "performer")
    .map((item) => peopleLabel.get(item.personId) ?? item.personId);
  const workDirectors = work.personRelations
    .filter((item) => item.role === "director")
    .map((item) => peopleLabel.get(item.personId) ?? item.personId);

  return [
    compareScalar("code", evidence.code ?? null, work.code),
    compareAgainstAlternatives(
      "title",
      evidence.title ?? evidence.originalTitle ?? null,
      Object.values(work.titles).filter((value): value is string => Boolean(value)),
    ),
    compareScalar("releaseDate", evidence.releaseDate ?? null, work.releaseDate?.value ?? null),
    compareScalar("durationMinutes", evidence.durationMinutes ?? null, work.durationMinutes ?? null),
    compareAgainstAlternatives(
      "description",
      evidence.description ?? null,
      Object.values(work.descriptions ?? {}).filter((value): value is string => Boolean(value)),
    ),
    compareEntityList("performers", evidence.performers, resolved.performers, workPerformers),
    compareEntityList("directors", evidence.directors, resolved.directors, workDirectors),
    compareResolvedScalar(
      "maker",
      evidence.maker ?? null,
      resolved.maker,
      work.makerId ? organizationLabel.get(work.makerId) ?? work.makerId : null,
      work.makerId,
    ),
    compareResolvedScalar(
      "label",
      evidence.label ?? null,
      resolved.label,
      work.labelId ? organizationLabel.get(work.labelId) ?? work.labelId : null,
      work.labelId,
    ),
    compareResolvedList(
      "series",
      evidence.series,
      resolved.series,
      work.seriesIds,
      seriesLabel,
    ),
    compareResolvedList(
      "genres",
      evidence.genres,
      resolved.genres,
      work.genreIds,
      genreLabel,
    ),
    compareResolvedList(
      "tags",
      evidence.tags,
      resolved.tags,
      work.tagIds,
      tagLabel,
    ),
    compareResolvedList(
      "workTypes",
      evidence.workTypes,
      resolved.workTypes,
      work.workTypeIds,
      workTypeLabel,
    ),
  ];
}

function compareScalar(
  field: ReviewFieldComparison["field"],
  evidenceValue: string | number | null,
  libraryValue: string | number | null,
): ReviewFieldComparison {
  return {
    field,
    evidenceValue,
    libraryValue,
    status: comparePresenceAndEquality(evidenceValue, libraryValue),
  };
}

function compareAgainstAlternatives(
  field: ReviewFieldComparison["field"],
  evidenceValue: string | null,
  libraryValues: string[],
): ReviewFieldComparison {
  const libraryValue: ReviewFieldValue = libraryValues.length ? libraryValues : null;
  if (!evidenceValue) {
    return { field, evidenceValue: null, libraryValue, status: libraryValues.length ? "library_only" : "same" };
  }
  if (!libraryValues.length) {
    return { field, evidenceValue, libraryValue: null, status: "evidence_only" };
  }

  const matches = libraryValues.some(
    (value) => normalizeIdentityText(value) === normalizeIdentityText(evidenceValue),
  );
  return { field, evidenceValue, libraryValue, status: matches ? "same" : "different" };
}

function compareResolvedScalar(
  field: ReviewFieldComparison["field"],
  evidenceValue: string | null,
  resolution: EntityResolution | undefined,
  libraryLabel: string | null,
  libraryId: string | undefined,
): ReviewFieldComparison {
  if (!evidenceValue) {
    return {
      field,
      evidenceValue: null,
      libraryValue: libraryLabel,
      status: libraryId ? "library_only" : "same",
    };
  }
  if (!libraryId) {
    return { field, evidenceValue, libraryValue: null, status: "evidence_only" };
  }

  return {
    field,
    evidenceValue,
    libraryValue: libraryLabel,
    status: resolution?.matchedId === libraryId ? "same" : "different",
  };
}

function compareEntityList(
  field: ReviewFieldComparison["field"],
  evidenceLabels: string[],
  resolutions: EntityResolution[],
  libraryLabels: string[],
): ReviewFieldComparison {
  const matchedIds = resolutions
    .filter((item) => item.status === "matched" && item.matchedId)
    .map((item) => item.matchedId as string);

  // Person 比较需要从 Resolution 的 matchedId 与 Work relation 的 personId 比较。
  // 调用方提供的 libraryLabels 只负责展示，因此这里利用 matchedLabel 进行稳定集合比较。
  const matchedLabels = resolutions
    .filter((item) => item.status === "matched")
    .map((item) => item.matchedLabel ?? item.sourceValue);

  void matchedIds; // 保留 matchedIds，便于 V1-06 生成真正的关系写入计划。

  return compareListValues(field, evidenceLabels, libraryLabels, matchedLabels);
}

function compareResolvedList(
  field: ReviewFieldComparison["field"],
  evidenceLabels: string[],
  resolutions: EntityResolution[],
  libraryIds: string[],
  libraryLabels: Map<string, string>,
): ReviewFieldComparison {
  const resolvedIds = resolutions
    .filter((item) => item.status === "matched" && item.matchedId)
    .map((item) => item.matchedId as string);
  const canonicalLabels = libraryIds.map((id) => libraryLabels.get(id) ?? id);

  const status = compareIdSets(evidenceLabels.length, resolvedIds, libraryIds, resolutions);
  return {
    field,
    evidenceValue: evidenceLabels.length ? evidenceLabels : null,
    libraryValue: canonicalLabels.length ? canonicalLabels : null,
    status,
  };
}

function compareListValues(
  field: ReviewFieldComparison["field"],
  evidenceLabels: string[],
  libraryLabels: string[],
  resolvedLabels: string[],
): ReviewFieldComparison {
  if (!evidenceLabels.length) {
    return {
      field,
      evidenceValue: null,
      libraryValue: libraryLabels.length ? libraryLabels : null,
      status: libraryLabels.length ? "library_only" : "same",
    };
  }
  if (!libraryLabels.length) {
    return { field, evidenceValue: evidenceLabels, libraryValue: null, status: "evidence_only" };
  }

  const evidenceSet = new Set(resolvedLabels.map(normalizeIdentityText));
  const librarySet = new Set(libraryLabels.map(normalizeIdentityText));
  const same = evidenceSet.size === librarySet.size && [...evidenceSet].every((item) => librarySet.has(item));

  return {
    field,
    evidenceValue: evidenceLabels,
    libraryValue: libraryLabels,
    status: same ? "same" : "different",
  };
}

function compareIdSets(
  evidenceCount: number,
  resolvedIds: string[],
  libraryIds: string[],
  resolutions: EntityResolution[],
): ReviewFieldComparison["status"] {
  if (evidenceCount === 0) return libraryIds.length ? "library_only" : "same";
  if (libraryIds.length === 0) return "evidence_only";
  if (resolutions.some((item) => item.status !== "matched")) return "different";

  const evidenceSet = new Set(resolvedIds);
  const librarySet = new Set(libraryIds);
  return evidenceSet.size === librarySet.size && [...evidenceSet].every((id) => librarySet.has(id))
    ? "same"
    : "different";
}

function comparePresenceAndEquality(
  evidenceValue: string | number | null,
  libraryValue: string | number | null,
): ReviewFieldComparison["status"] {
  if (evidenceValue === null) return libraryValue === null ? "same" : "library_only";
  if (libraryValue === null) return "evidence_only";

  if (typeof evidenceValue === "string" && typeof libraryValue === "string") {
    return normalizeIdentityText(evidenceValue) === normalizeIdentityText(libraryValue)
      ? "same"
      : "different";
  }
  return evidenceValue === libraryValue ? "same" : "different";
}

function localizedTextMatches(
  names: { ja?: string; "zh-CN"?: string; en?: string },
  sourceValue: string,
): boolean {
  const sourceKey = normalizeIdentityText(sourceValue);
  return Object.values(names)
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeIdentityText(value) === sourceKey);
}

function getJapaneseOrFirstPersonName(person: Person): string {
  return (
    person.names.find((name) => name.language === "ja" && name.type === "primary")?.value ??
    person.names.find((name) => name.type === "primary")?.value ??
    person.names[0]?.value ??
    person.id
  );
}

/**
 * “规范化后的精确匹配”只处理 Unicode 形态、大小写和无意义空白。
 *
 * 这里故意不做编辑距离、拼音相似度、自动汉字转换等模糊匹配：
 * 资料治理系统宁可产生一个“新实体候选”，也不能为了高召回率而合错人。
 */
export function normalizeIdentityText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, "");
}
