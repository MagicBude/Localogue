import type { ImportPreview } from "@/domain/entities/evidence";
import { CsvMetadataImporter } from "@/infrastructure/importers/csv-importer";
import type { ImportInput, MetadataImporter } from "@/infrastructure/importers/importer-types";
import { JsonMetadataImporter } from "@/infrastructure/importers/json-importer";
import { NfoMetadataImporter } from "@/infrastructure/importers/nfo-importer";
import { XlsxMetadataImporter } from "@/infrastructure/importers/xlsx-importer";

const importers: MetadataImporter[] = [
  new JsonMetadataImporter(),
  new NfoMetadataImporter(),
  new CsvMetadataImporter(),
  new XlsxMetadataImporter(),
];

/**
 * Registry 把“文件扩展名判断”集中到基础设施层。
 * 页面和 API Route 不需要知道每一种格式由哪个具体 Parser 处理。
 */
export async function previewImport(input: ImportInput): Promise<ImportPreview> {
  const importer = importers.find((candidate) => candidate.canHandle(input.fileName));
  if (!importer) {
    throw new Error("暂不支持该文件格式。V1-04 支持 JSON、NFO、CSV 和 XLSX。 ");
  }
  return importer.parse(input);
}
