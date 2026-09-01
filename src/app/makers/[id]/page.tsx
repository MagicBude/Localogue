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

interface MakerDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MakerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const maker = await libraryRepository.findOrganizationById(id);
  return { title: maker?.names.ja ?? maker?.names["zh-CN"] ?? maker?.names.en ?? "厂商详情" };
}

export default async function MakerDetailPage({ params }: MakerDetailPageProps) {
  const [{ id }, preferences] = await Promise.all([params, getUserPreferences()]);
  const maker = await libraryRepository.findOrganizationById(id);
  if (!maker || maker.kind !== "maker") notFound();

  const dictionary = getUiDictionary(preferences.uiLanguage);
  const [workResult, organizations, workTypeLabels] = await Promise.all([
    libraryRepository.listWorks({ makerIds: [maker.id], page: 1, pageSize: 8 }),
    libraryRepository.listOrganizations(),
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
  const labels = organizations.filter(
    (item) => item.kind === "label" && item.parentOrganizationId === maker.id,
  );

  return (
    <CatalogEntityDetail
      description={localizeText(maker.descriptions, preferences.metadataLanguage, "")}
      dictionary={dictionary}
      eyebrow="CATALOG · MAKER"
      names={maker.names}
      relatedLinks={labels.map((label) => ({
        href: `/labels/${label.id}`,
        label: localizeText(label.names, preferences.metadataLanguage, label.id),
      }))}
      relatedTitle={dictionary.relatedLabels}
      title={localizeText(maker.names, preferences.metadataLanguage, maker.id)}
      totalWorks={workResult.total}
      works={works}
      worksHref={`/works?maker=${encodeURIComponent(maker.id)}`}
      workTypeLabels={workTypeLabels}
    />
  );
}
