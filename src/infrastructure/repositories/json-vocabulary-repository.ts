import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  VocabularyDocument,
  VocabularyName,
  VocabularyRepository,
} from "@/domain/repositories/vocabulary-repository";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { localizeText } from "@/application/services/localization-service";

/**
 * 受控词表本身也是项目资产，所以 V1 直接读取 resources/vocabularies。
 * 这样 Markdown 文档、CSV 对照表和程序使用的稳定 ID 都围绕同一份定义演进。
 */
export class JsonVocabularyRepository implements VocabularyRepository {
  constructor(
    private readonly rootDirectory = path.join(
      process.cwd(),
      "resources",
      "vocabularies",
    ),
  ) {}

  async load(name: VocabularyName): Promise<VocabularyDocument> {
    const raw = await readFile(path.join(this.rootDirectory, `${name}.json`), "utf8");
    return JSON.parse(raw) as VocabularyDocument;
  }

  async getLabel(
    name: VocabularyName,
    id: string,
    language: SupportedLanguage,
  ): Promise<string> {
    const vocabulary = await this.load(name);
    const item = vocabulary.items.find((candidate) => candidate.id === id);
    return item ? localizeText(item, language, id) : id;
  }
}
