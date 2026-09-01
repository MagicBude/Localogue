import type { ImportPreview } from "@/domain/entities/evidence";

export interface ImportInput {
  fileName: string;
  bytes: Uint8Array;
}

export interface MetadataImporter {
  canHandle(fileName: string): boolean;
  parse(input: ImportInput): Promise<ImportPreview>;
}
