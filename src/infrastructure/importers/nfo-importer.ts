import { XMLParser } from "fast-xml-parser";

import type { ImportPreview } from "@/domain/entities/evidence";
import { isRecord, normalizeLooseRecord } from "@/application/importers/import-normalizer";
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

    const raw = adaptNfoMovie(movie);
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

function adaptNfoMovie(movie: Record<string, unknown>): Record<string, unknown> {
  return {
    code: movie.num ?? movie.number ?? movie.id ?? movie.uniqueid,
    title: movie.title,
    originalTitle: movie.originaltitle,
    releaseDate: movie.premiered ?? movie.releasedate ?? movie.dateadded,
    runtime: movie.runtime,
    actors: extractNames(movie.actor),
    director: extractNames(movie.director),
    studio: movie.studio,
    series: movie.set,
    genre: movie.genre,
    tag: movie.tag,
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
