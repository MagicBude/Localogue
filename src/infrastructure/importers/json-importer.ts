import type { ImportCandidate, ImportPreview } from "@/domain/entities/evidence";
import {
  isRecord,
  normalizeLocalogueWork,
  normalizeLooseRecord,
} from "@/application/importers/import-normalizer";
import { validateImportCandidate } from "@/application/importers/import-validation";
import type { ImportInput, MetadataImporter } from "@/infrastructure/importers/importer-types";

export class JsonMetadataImporter implements MetadataImporter {
  canHandle(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".json");
  }

  async parse(input: ImportInput): Promise<ImportPreview> {
    const text = new TextDecoder("utf-8").decode(input.bytes);
    const parsed: unknown = JSON.parse(text);
    const rows = extractJsonRows(parsed);
    const warnings: ImportPreview["warnings"] = [];

    const candidates = rows.flatMap((row, index): ImportCandidate[] => {
      if (!isRecord(row)) {
        warnings.push({ code: "json_row_not_object", detail: String(index + 1) });
        return [];
      }

      const looksLikeLocalogueWork =
        typeof row.schemaVersion === "number" &&
        typeof row.code === "string" &&
        isRecord(row.titles);
      const normalized = looksLikeLocalogueWork
        ? normalizeLocalogueWork(row)
        : normalizeLooseRecord(row);

      return [{
        index: index + 1,
        raw: row,
        normalized,
        warnings: validateImportCandidate(normalized),
      }];
    });

    return {
      sourceType: "localogue_json",
      sourceName: input.fileName,
      candidateCount: candidates.length,
      candidates,
      warnings,
    };
  }
}


/**
 * 常见 API 会用 `{ items: [{ item: {...} }] }` 包一层响应元信息。
 * Importer 在这里仅负责拆掉“传输包装”，不做业务实体匹配。
 */
function extractJsonRows(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!isRecord(parsed)) return [parsed];

  if (Array.isArray(parsed.items)) {
    return parsed.items.map((entry) =>
      isRecord(entry) && isRecord(entry.item) ? entry.item : entry,
    );
  }

  return [parsed];
}
