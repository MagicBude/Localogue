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

interface SeriesDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SeriesDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const series = await libraryRepository.findSeriesById(id);
  return { title: series?.names.ja ?? series?.names["zh-CN"] ?? series?.names.en ?? "系列详情" };
}

export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const [{ id }, preferences] = await Promise.all([params, getUserPreferences()]);
  const series = await libraryRepository.findSeriesById(id);
  if (!series) notFound();

  const dictionary = getUiDictionary(preferences.uiLanguage);
  const [workResult, workTypeLabels] = await Promise.all([
    libraryRepository.listWorks({ seriesIds: [series.id], page: 1, pageSize: 8 }),
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
      description={localizeText(series.descriptions, preferences.metadataLanguage, "")}
      dictionary={dictionary}
      eyebrow="CATALOG · SERIES"
      names={series.names}
      title={localizeText(series.names, preferences.metadataLanguage, series.id)}
      totalWorks={workResult.total}
      works={works}
      worksHref={`/works?series=${encodeURIComponent(series.id)}`}
      workTypeLabels={workTypeLabels}
    />
  );
}
