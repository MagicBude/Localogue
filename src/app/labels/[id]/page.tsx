import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { localizeText } from "@/application/services/localization-service";
import { presentWorkCard } from "@/application/services/work-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { CatalogEntityDetail } from "@/components/catalog-entity-detail";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

interface LabelDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LabelDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const label = await libraryRepository.findOrganizationById(id);
  return { title: label?.names.ja ?? label?.names["zh-CN"] ?? label?.names.en ?? "厂牌详情" };
}

export default async function LabelDetailPage({ params }: LabelDetailPageProps) {
  const [{ id }, preferences] = await Promise.all([params, getUserPreferences()]);
  const label = await libraryRepository.findOrganizationById(id);
  if (!label || label.kind !== "label") notFound();

  const dictionary = getUiDictionary(preferences.uiLanguage);
  const [workResult, parentMaker, workTypeLabels] = await Promise.all([
    libraryRepository.listWorks({ labelIds: [label.id], page: 1, pageSize: 8 }),
    label.parentOrganizationId
      ? libraryRepository.findOrganizationById(label.parentOrganizationId)
      : Promise.resolve(null),
    getVocabularyLabelMap(
      vocabularyRepository,
      "work-types",
      preferences.metadataLanguage,
    ),
  ]);
  const works = await Promise.all(
    workResult.items.map((work) =>
      presentWorkCard(libraryRepository, work, preferences.metadataLanguage),
    ),
  );

  return (
    <CatalogEntityDetail
      description={localizeText(label.descriptions, preferences.metadataLanguage, "")}
      dictionary={dictionary}
      eyebrow="CATALOG · LABEL"
      facts={parentMaker ? [{
        label: dictionary.parentMaker,
        value: localizeText(parentMaker.names, preferences.metadataLanguage, parentMaker.id),
      }] : []}
      names={label.names}
      relatedLinks={parentMaker ? [{
        href: `/makers/${parentMaker.id}`,
        label: localizeText(parentMaker.names, preferences.metadataLanguage, parentMaker.id),
      }] : []}
      relatedTitle={dictionary.parentMaker}
      title={localizeText(label.names, preferences.metadataLanguage, label.id)}
      totalWorks={workResult.total}
      works={works}
      worksHref={`/works?label=${encodeURIComponent(label.id)}`}
      workTypeLabels={workTypeLabels}
    />
  );
}
