import type {
  CareerEvent,
  CareerEventType,
  Person,
  PersonActivityStatus,
  PersonName,
  PersonNameType,
} from "@/domain/entities/person";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import type { PartialDate } from "@/domain/value-objects/partial-date";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { savePersonEditReceipt } from "@/infrastructure/people/person-edit-store";

const statuses: PersonActivityStatus[] = ["active", "retired", "hiatus", "inactive", "unknown"];
const nameTypes: PersonNameType[] = ["primary", "localized", "romanized", "alias", "former_name", "stage_name", "alternate"];
const eventTypes: CareerEventType[] = ["debut", "retirement", "return", "hiatus_start", "hiatus_end", "name_change", "other"];
const languages: SupportedLanguage[] = ["ja", "zh-CN", "en"];

export interface PersonEditInput {
  activityStatus: PersonActivityStatus;
  names: PersonName[];
  careerEvents: CareerEvent[];
  birthDate?: PartialDate;
  birthPlace?: { ja?: string; "zh-CN"?: string; en?: string };
  heightCm?: number;
  measurements?: { bustCm?: number; waistCm?: number; hipCm?: number; cup?: string };
  biographies?: { ja?: string; "zh-CN"?: string; en?: string };
  portraitAssetId?: string;
  galleryAssetIds: string[];
}

export async function updatePersonFromManualEdit(
  repository: LibraryRepository,
  personId: string,
  raw: unknown,
) {
  const before = await repository.findPersonById(personId);
  if (!before) throw new PersonEditError("person_not_found", 404);

  const input = parsePersonEditInput(raw);
  await validateAssetReferences(repository, input);
  const after: Person = {
    ...before,
    ...input,
    id: before.id,
    schemaVersion: before.schemaVersion,
    createdAt: before.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const changedFields = changedTopLevelFields(before, after);
  if (!changedFields.length) {
    return { person: before, receipt: null, changedFields: [] };
  }

  // 先保存 Person，再保存审计 Receipt。单文件写入使用临时文件 + rename。
  // V1 JSON 尚非真正事务，因此如果 Receipt 写入失败会向调用方抛错并提示人工检查。
  await repository.savePerson(after);
  try {
    const receipt = await savePersonEditReceipt(before, after, changedFields);
    return { person: after, receipt, changedFields };
  } catch (error) {
    // JSON 阶段没有跨文件事务。Receipt 写入失败时，用 before-image 做补偿式恢复，
    // 尽量保证“Person 已改但没有审计记录”的状态不会长期存在。
    await repository.savePerson(before);
    throw error;
  }
}

export class PersonEditError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
  }
}

async function validateAssetReferences(
  repository: LibraryRepository,
  input: PersonEditInput,
): Promise<void> {
  const assetIds = [input.portraitAssetId, ...input.galleryAssetIds].filter(
    (id): id is string => Boolean(id),
  );
  for (const assetId of assetIds) {
    if (!(await repository.findAssetById(assetId))) {
      throw new PersonEditError(`asset_not_found:${assetId}`);
    }
  }
}

function parsePersonEditInput(raw: unknown): PersonEditInput {
  if (!isRecord(raw)) throw new PersonEditError("invalid_payload");
  if (!statuses.includes(raw.activityStatus as PersonActivityStatus)) throw new PersonEditError("invalid_status");

  const names = parseNames(raw.names);
  if (!names.some((name) => name.type === "primary" && name.language === "ja" && name.value.trim())) {
    throw new PersonEditError("missing_primary_ja_name");
  }

  return {
    activityStatus: raw.activityStatus as PersonActivityStatus,
    names,
    careerEvents: parseCareerEvents(raw.careerEvents),
    birthDate: parsePartialDate(optionalString(raw.birthDate)),
    birthPlace: cleanLocalizedText(raw.birthPlace),
    heightCm: optionalPositiveNumber(raw.heightCm),
    measurements: parseMeasurements(raw.measurements),
    biographies: cleanLocalizedText(raw.biographies),
    portraitAssetId: optionalString(raw.portraitAssetId),
    galleryAssetIds: stringArray(raw.galleryAssetIds),
  };
}

function parseNames(value: unknown): PersonName[] {
  if (!Array.isArray(value)) throw new PersonEditError("invalid_names");
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const language = item.language as SupportedLanguage;
    const type = item.type as PersonNameType;
    const name = optionalString(item.value);
    if (!languages.includes(language) || !nameTypes.includes(type) || !name) return [];
    return [{ language, type, value: name, validFrom: optionalString(item.validFrom), validTo: optionalString(item.validTo) }];
  });
}

function parseCareerEvents(value: unknown): CareerEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const type = item.type as CareerEventType;
    if (!eventTypes.includes(type)) return [];
    const dateValue = isRecord(item.date) ? optionalString(item.date.value) : optionalString(item.date);
    return [{ type, date: parsePartialDate(dateValue), note: optionalString(item.note) }];
  });
}

function parseMeasurements(value: unknown) {
  if (!isRecord(value)) return undefined;
  const measurements = {
    bustCm: optionalPositiveNumber(value.bustCm),
    waistCm: optionalPositiveNumber(value.waistCm),
    hipCm: optionalPositiveNumber(value.hipCm),
    cup: optionalString(value.cup),
  };
  return Object.values(measurements).some((item) => item !== undefined) ? measurements : undefined;
}

function cleanLocalizedText(value: unknown) {
  if (!isRecord(value)) return undefined;
  const result = {
    ja: optionalString(value.ja),
    "zh-CN": optionalString(value["zh-CN"]),
    en: optionalString(value.en),
  };
  return Object.values(result).some(Boolean) ? result : undefined;
}

function parsePartialDate(value: string | undefined): PartialDate | undefined {
  if (!value) return undefined;
  if (/^\d{4}$/.test(value)) return { value, precision: "year" };
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { value, precision: "month" };
  if (/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return { value, precision: "day" };
  throw new PersonEditError("invalid_partial_date");
}

function changedTopLevelFields(before: Person, after: Person): string[] {
  const keys: Array<keyof Person> = [
    "names", "activityStatus", "careerEvents", "birthDate", "birthPlace", "heightCm",
    "measurements", "biographies", "portraitAssetId", "galleryAssetIds",
  ];
  return keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
