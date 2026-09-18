import type { ReactNode } from "react";

import type { WorkQuery } from "@/domain/queries/work-query";

import { useDesktopI18n } from "./desktop-i18n";
import { buildDesktopWorkCards, DesktopWorkResults } from "./desktop-work-results";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useStableAsyncData } from "./use-stable-async-data";
import { UiButton } from "./ui/button";
import { UiEmptyState } from "./ui/feedback";

/**
 * Desktop 工作台只提供资料库状态、待处理事项和最近活动。
 * 完整作品、人物和分类浏览交给资料库页签，避免工作台变成第二个作品库。
 */
export function DesktopHomePage({
  repository,
  openWork,
  openPerson,
  openWorks,
  filterWorks,
  openMedia,
  startUnifiedSync,
  contentFolderCount,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  openWorks: () => void;
  filterWorks: (query: WorkQuery) => void;
  openMedia: () => void;
  startUnifiedSync: () => void;
  contentFolderCount: number;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const data = useStableAsyncData(async () => {
    const [works, people, organizations, series, media, assets, preferences, genres, tags] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 100_000, sort: "release_desc" }),
      repository.listPeople({ page: 1, pageSize: 100_000, sort: "name_asc" }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listMediaFiles(),
      repository.listAssets(),
      repository.listPresentationPreferences(),
      repository.listGenres(),
      repository.listTags(),
    ]);
    const recentWorks = works.items.slice(0, 12);
    return {
      works,
      people,
      organizations,
      series,
      media,
      recentCards: buildDesktopWorkCards(recentWorks, people.items, organizations, assets, metadataLanguage, preferences, genres, tags),
    };
  }, [repository, metadataLanguage], toMessage);

  if (data.loading) return <UiEmptyState busy title={t("正在读取影片库…")} />;
  if (data.error || !data.value) return <UiEmptyState tone="error" title={t("无法读取影片库。")} description={data.error} />;
  const { works, people, organizations, series, media, recentCards } = data.value;
  const unlinkedMediaCount = media.filter((file) => !file.workId).length;

  return (
    <div className="page-stack">
      <section className="hero-panel desktop-hero">
        <div className="desktop-home-hero-copy">
          <span className="eyebrow">WORKSPACE</span>
          <h1>{t("资料库工作台")}</h1>
          <p>{t("查看当前影片库状态，处理扫描结果，再继续浏览作品和人物。")}</p>
        </div>
        <div className="button-row desktop-home-primary-actions">
          <UiButton variant="primary" onClick={startUnifiedSync}>{t("扫描资料库")}</UiButton>
          {unlinkedMediaCount ? <UiButton variant="ghost" onClick={openMedia}>{t("处理 {count} 个未关联媒体", { count: unlinkedMediaCount })}</UiButton> : null}
        </div>
      </section>
      <section className="stat-grid">
        <Stat label={t("作品")} value={works.total} />
        <Stat label={t("人物")} value={people.total} />
        <Stat label={t("内容目录")} value={contentFolderCount} />
        <Stat label={t("系列")} value={series.length} />
        <Stat label={t("视频文件")} value={media.length} />
        <Stat label={t("待关联媒体")} value={unlinkedMediaCount} />
      </section>
      <section className="settings-card">
        <SectionTitle eyebrow="NEXT STEP" title={t("下一步")}/>
        <p className="muted">{unlinkedMediaCount ? t("有媒体文件尚未关联作品，建议先处理这些文件。") : t("资料库目前没有待处理媒体，可以继续浏览或扫描新增内容。")}</p>
        <div className="button-row">
          <UiButton variant="ghost" onClick={openWorks}>{t("浏览作品")}</UiButton>
          {unlinkedMediaCount ? <UiButton onClick={openMedia}>{t("查看未关联媒体")}</UiButton> : null}
        </div>
      </section>
      <SectionTitle
        eyebrow="RECENT WORKS"
        title={t("最近活动")}
        action={<UiButton variant="ghost" onClick={openWorks}>{t("查看全部作品")}</UiButton>}
      />
      <DesktopWorkResults cards={recentCards} view="grid" onOpen={openWork} onOpenPerson={openPerson}
        onSelectGenre={(id) => filterWorks({ genreIds: [id] })}
        onSelectTag={(id) => filterWorks({ tagIds: [id] })} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong></article>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}
