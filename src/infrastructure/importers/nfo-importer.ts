import { XMLParser } from "fast-xml-parser";

import type { ImportPreview } from "@/domain/entities/evidence";
import { isRecord, normalizeLooseRecord } from "@/application/importers/import-normalizer";
import { inferNfoFilenameMetadata, normalizeNfoCode } from "@/application/importers/nfo-filename-metadata";
import { validateImportCandidate } from "@/application/importers/import-validation";
import type { ImportInput, MetadataImporter } from "@/infrastructure/importers/importer-types";

export class NfoMetadataImporter implements MetadataImporter {
  canHandle(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".nfo");
  }

  async parse(input: ImportInput): Promise<ImportPreview> {
    const xml = new TextDecoder("utf-8").decode(input.bytes);
    const parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
      parseTagValue: true,
    });
    const document: unknown = parser.parse(xml);
    const movie = isRecord(document) && isRecord(document.movie) ? document.movie : document;
    if (!isRecord(movie)) throw new Error("NFO 中没有识别到 <movie> 元数据。");

    const raw = adaptNfoMovie(movie, input.fileName);
    const normalized = normalizeLooseRecord(raw);

    return {
      sourceType: "nfo",
      sourceName: input.fileName,
      candidateCount: 1,
      candidates: [{
        index: 1,
        raw: movie,
        normalized,
        warnings: validateImportCandidate(normalized),
      }],
      warnings: [],
    };
  }
}

function adaptNfoMovie(movie: Record<string, unknown>, fileName: string): Record<string, unknown> {
  const fallback = inferNfoFilenameMetadata(fileName);
  return {
    code: extractNormalizedCode(movie) ?? fallback.code,
    title: movie.title ?? fallback.title,
    originalTitle: movie.originaltitle,
    releaseDate: movie.premiered ?? movie.releasedate ?? movie.dateadded ?? fallback.releaseDate,
    runtime: movie.runtime,
    actors: extractNames(movie.actor),
    director: extractNames(movie.director),
    maker: movie.maker ?? movie.studio,
    label: movie.label,
    series: extractNames(movie.series ?? movie.set),
    genre: extractNames(movie.genre),
    tag: extractNames(movie.tag),
    plot: movie.plot ?? movie.outline,
  };
}

function extractNames(value: unknown): unknown {
  if (!Array.isArray(value)) {
    if (isRecord(value)) return value.name;
    return value;
  }

  return value.map((item) => (isRecord(item) ? item.name : item));
}


function extractNormalizedCode(movie: Record<string, unknown>): string | undefined {
  // NFO 生态里 <id> / <uniqueid> 经常同时包含 TMDB 等纯数字 ID。
  // 不能“取第一个再判断”，而要逐项寻找第一个真正像番号的值。
  for (const value of [movie.num, movie.number, movie.code, movie.productid, movie.id]) {
    const normalized = normalizeExtractedCode(value);
    if (normalized) return normalized;
  }

  const unique = movie.uniqueid;
  const values = Array.isArray(unique) ? unique : [unique];
  for (const item of values) {
    const normalized = normalizeExtractedCode(extractUniqueIdValue(item) ?? item);
    if (normalized) return normalized;
  }
  return undefined;
}

function extractUniqueIdValue(value: unknown): unknown {
  if (!isRecord(value)) return undefined;
  for (const key of ["#text", "value", "id"]) {
    const candidate = value[key];
    if (typeof candidate === "string" || typeof candidate === "number") return candidate;
  }
  return undefined;
}

function normalizeExtractedCode(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return normalizeNfoCode(String(value));
}

