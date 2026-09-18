import type { ReactNode } from "react";

import { useDesktopI18n } from "./desktop-i18n";
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
  openWorks,
  openMedia,
  startUnifiedSync,
  contentFolderCount,
}: {
  repository: TauriLibraryRepository;
  openWorks: () => void;
  openMedia: () => void;
  startUnifiedSync: () => void;
  contentFolderCount: number;
}) {
  const { t } = useDesktopI18n();
  const data = useStableAsyncData(() => repository.getLibrarySummary(), [repository], toMessage);

  if (data.loading) return <UiEmptyState busy title={t("正在读取影片库…")} />;
  if (data.error || !data.value) return <UiEmptyState tone="error" title={t("无法读取影片库。")} description={data.error} />;
  const { works, people, series, mediaFiles, unlinkedMediaFiles } = data.value;

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
          {unlinkedMediaFiles ? <UiButton variant="ghost" onClick={openMedia}>{t("处理 {count} 个未关联媒体", { count: unlinkedMediaFiles })}</UiButton> : null}
        </div>
      </section>
      <section className="stat-grid">
        <Stat label={t("作品")} value={works} />
        <Stat label={t("人物")} value={people} />
        <Stat label={t("内容目录")} value={contentFolderCount} />
        <Stat label={t("系列")} value={series} />
        <Stat label={t("视频文件")} value={mediaFiles} />
        <Stat label={t("待关联媒体")} value={unlinkedMediaFiles} />
      </section>
      <section className="settings-card">
        <SectionTitle eyebrow="NEXT STEP" title={t("下一步")}/>
        <p className="muted">{unlinkedMediaFiles ? t("有媒体文件尚未关联作品，建议先处理这些文件。") : t("资料库目前没有待处理媒体，可以继续浏览或扫描新增内容。")}</p>
        <div className="button-row">
          <UiButton variant="ghost" onClick={openWorks}>{t("浏览作品")}</UiButton>
          {unlinkedMediaFiles ? <UiButton onClick={openMedia}>{t("查看未关联媒体")}</UiButton> : null}
        </div>
      </section>
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
