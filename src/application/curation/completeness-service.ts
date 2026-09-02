import type { Asset } from "@/domain/entities/asset";
import type {
  CompletenessCheck,
  CompletenessLevel,
  CompletenessResult,
} from "@/domain/entities/completeness";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";

/**
 * Work 完整度权重总计 100。
 *
 * 注意：mediaFileIds 不参与评分。Localogue 允许先建立作品资料，再决定是否拥有本地影片。
 */
const WORK_RULES = {
  code: 10,
  original_title: 12,
  release_date: 10,
  duration: 8,
  performers: 12,
  maker: 8,
  label: 5,
  series: 5,
  work_type: 7,
  genres: 7,
  description: 6,
  cover: 10,
} as const;

/** Person 完整度权重同样总计 100。 */
const PERSON_RULES = {
  primary_name: 12,
  localized_name: 6,
  romanized_name: 5,
  activity_status: 7,
  debut: 8,
  birth_date: 8,
  birth_place: 6,
  height: 5,
  measurements: 8,
  biography: 8,
  portrait: 10,
  aliases: 5,
  career_events: 6,
  gallery: 6,
} as const;

export function calculateWorkCompleteness(
  work: Work,
  assetsById: ReadonlyMap<string, Asset>,
): CompletenessResult {
  const originalTitle = work.titles[work.originalLanguage]?.trim();
  const hasPerformers = work.personRelations.some(
    (relation) => relation.role === "performer",
  );
  const hasCover = work.assetIds.some((assetId) => {
    const asset = assetsById.get(assetId);
    return asset?.type === "cover" || asset?.type === "poster";
  });

  return finalize([
    check("code", WORK_RULES.code, Boolean(work.code.trim())),
    check("original_title", WORK_RULES.original_title, Boolean(originalTitle)),
    check("release_date", WORK_RULES.release_date, Boolean(work.releaseDate?.value)),
    check("duration", WORK_RULES.duration, (work.durationMinutes ?? 0) > 0),
    check("performers", WORK_RULES.performers, hasPerformers),
    check("maker", WORK_RULES.maker, Boolean(work.makerId)),
    check("label", WORK_RULES.label, Boolean(work.labelId)),
    check("series", WORK_RULES.series, work.seriesIds.length > 0),
    check("work_type", WORK_RULES.work_type, work.workTypeIds.length > 0),
    check("genres", WORK_RULES.genres, work.genreIds.length > 0),
    check(
      "description",
      WORK_RULES.description,
      Boolean(work.descriptions?.[work.originalLanguage]?.trim()),
    ),
    check("cover", WORK_RULES.cover, hasCover),
  ]);
}

export function calculatePersonCompleteness(person: Person): CompletenessResult {
  const hasName = (type: Person["names"][number]["type"], language?: string) =>
    person.names.some(
      (name) =>
        name.type === type &&
        (!language || name.language === language) &&
        Boolean(name.value.trim()),
    );

  const hasAliases = person.names.some((name) =>
    ["alias", "former_name", "stage_name", "alternate"].includes(name.type),
  );
  const hasMeasurements = Boolean(
    person.measurements?.bustCm ||
      person.measurements?.waistCm ||
      person.measurements?.hipCm ||
      person.measurements?.cup,
  );

  return finalize([
    check("primary_name", PERSON_RULES.primary_name, hasName("primary", "ja")),
    check("localized_name", PERSON_RULES.localized_name, hasName("localized", "zh-CN")),
    check("romanized_name", PERSON_RULES.romanized_name, hasName("romanized", "en")),
    check(
      "activity_status",
      PERSON_RULES.activity_status,
      person.activityStatus !== "unknown",
    ),
    check(
      "debut",
      PERSON_RULES.debut,
      person.careerEvents.some((event) => event.type === "debut" && event.date?.value),
    ),
    check("birth_date", PERSON_RULES.birth_date, Boolean(person.birthDate?.value)),
    check("birth_place", PERSON_RULES.birth_place, hasLocalizedText(person.birthPlace)),
    check("height", PERSON_RULES.height, (person.heightCm ?? 0) > 0),
    check("measurements", PERSON_RULES.measurements, hasMeasurements),
    check("biography", PERSON_RULES.biography, hasLocalizedText(person.biographies)),
    check("portrait", PERSON_RULES.portrait, Boolean(person.portraitAssetId)),
    check("aliases", PERSON_RULES.aliases, hasAliases),
    check("career_events", PERSON_RULES.career_events, person.careerEvents.length > 0),
    check("gallery", PERSON_RULES.gallery, person.galleryAssetIds.length > 0),
  ]);
}

function check(id: string, weight: number, passed: boolean): CompletenessCheck {
  return { id, weight, passed };
}

function finalize(checks: CompletenessCheck[]): CompletenessResult {
  const totalWeight = checks.reduce((sum, item) => sum + item.weight, 0);
  const passedWeight = checks
    .filter((item) => item.passed)
    .reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round((passedWeight / totalWeight) * 100);

  return {
    score,
    level: toLevel(score),
    checks,
    missingIds: checks.filter((item) => !item.passed).map((item) => item.id),
  };
}

function toLevel(score: number): CompletenessLevel {
  if (score >= 90) return "complete";
  if (score >= 75) return "good";
  if (score >= 50) return "needs_attention";
  return "incomplete";
}

function hasLocalizedText(value: Record<string, string | undefined> | undefined): boolean {
  if (!value) return false;
  return Object.values(value).some((text) => Boolean(text?.trim()));
}
