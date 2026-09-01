import ExcelJS from "exceljs";

import type { ImportCandidate, ImportPreview } from "@/domain/entities/evidence";
import { normalizeLooseRecord } from "@/application/importers/import-normalizer";
import { validateImportCandidate } from "@/application/importers/import-validation";
import type { ImportInput, MetadataImporter } from "@/infrastructure/importers/importer-types";

export class XlsxMetadataImporter implements MetadataImporter {
  canHandle(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".xlsx");
  }

  async parse(input: ImportInput): Promise<ImportPreview> {
    const workbook = new ExcelJS.Workbook();

    /*
     * ExcelJS 4.4.0 的类型声明把 xlsx.load() 的参数定义为
     * 一个继承自 ArrayBuffer 的 Buffer，而 Node.js 24 的 Buffer
     * 已经是泛型 Uint8Array。两者在 TypeScript 5.9 下不能直接赋值。
     *
     * 这里显式复制出标准 ArrayBuffer：
     * 1. 避免用 `as any` 掩盖真实的类型问题；
     * 2. 与 ExcelJS “load from an array buffer” 的 API 语义保持一致；
     * 3. 不依赖 Node.js Buffer，因此导入器的数据边界更清晰。
     */
    const workbookBuffer = new ArrayBuffer(input.bytes.byteLength);
    new Uint8Array(workbookBuffer).set(input.bytes);
    await workbook.xlsx.load(workbookBuffer);

    const worksheet = workbook.getWorksheet("作品") ?? workbook.worksheets[0];
    if (!worksheet) throw new Error("XLSX 中没有可读取的工作表。");

    const headers = readRow(worksheet.getRow(1));
    const candidates: ImportCandidate[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const values = readRow(worksheet.getRow(rowNumber));
      if (!values.some((value) => value.trim())) continue;

      const raw = Object.fromEntries(headers.map((header, column) => [header.trim(), values[column] ?? ""]));
      const normalized = normalizeLooseRecord(raw);
      candidates.push({
        index: rowNumber - 1,
        raw,
        normalized,
        warnings: validateImportCandidate(normalized),
      });
    }

    return {
      sourceType: "xlsx",
      sourceName: input.fileName,
      candidateCount: candidates.length,
      candidates,
      warnings: worksheet.name === "作品" ? [] : [{ code: "xlsx_fallback_sheet", detail: worksheet.name }],
    };
  }
}

function readRow(row: ExcelJS.Row): string[] {
  const values: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    values[columnNumber - 1] = cell.text.trim();
  });
  return values;
}
