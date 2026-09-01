import type { ImportCandidate, ImportPreview } from "@/domain/entities/evidence";
import { normalizeLooseRecord } from "@/application/importers/import-normalizer";
import { validateImportCandidate } from "@/application/importers/import-validation";
import type { ImportInput, MetadataImporter } from "@/infrastructure/importers/importer-types";

export class CsvMetadataImporter implements MetadataImporter {
  canHandle(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".csv");
  }

  async parse(input: ImportInput): Promise<ImportPreview> {
    const text = new TextDecoder("utf-8").decode(input.bytes).replace(/^\uFEFF/, "");
    const rows = parseCsv(text);
    if (!rows.length) throw new Error("CSV 文件为空。");

    const [headers, ...dataRows] = rows;
    const candidates: ImportCandidate[] = dataRows
      .filter((row) => row.some((cell) => cell.trim()))
      .map((row, index) => {
        const raw = Object.fromEntries(headers.map((header, column) => [header.trim(), row[column] ?? ""]));
        const normalized = normalizeLooseRecord(raw);
        return {
          index: index + 1,
          raw,
          normalized,
          warnings: validateImportCandidate(normalized),
        };
      });

    return {
      sourceType: "csv",
      sourceName: input.fileName,
      candidateCount: candidates.length,
      candidates,
      warnings: [],
    };
  }
}

/**
 * 一个小型 RFC4180 风格 CSV 解析器。
 * 支持双引号字段、字段中的逗号和双引号转义。V1 暂不处理复杂编码探测。
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}
