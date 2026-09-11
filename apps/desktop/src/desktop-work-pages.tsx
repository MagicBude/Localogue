import type { ReactNode } from "react";

import { workTypeDefinition } from "@/application/importers/import-classification-normalizer";
import { localizeGenre } from "@/application/services/genre-localization-service";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";
import type { WorkQuery } from "@/domain/queries/work-query";

import { CreateWorkPanel, WorkEditor } from "./desktop-work-management";
import { latestRecycledAsset, recyclePrivateAsset, restoreRecycledAsset } from "./desktop-asset-recycle-service";
import { sortWorkAssetsForManagement } from "./desktop-asset-order";
import { PresentationAssetPicker } from "./desktop-presentation-workbench";
import { resolveWorkPresentation } from "./desktop-presentation";
import { DesktopWorkAssetGallery } from "./desktop-work-asset-gallery";
import { DesktopWorkExplorer, type DesktopWorkExplorerState } from "./desktop-work-explorer";
import { DesktopWorkMediaSection } from "./desktop-work-media-section";
import { DesktopFavoriteButton } from "./desktop-favorite-button";
import { DesktopRatingControl } from "./desktop-rating-control";
import { useDesktopI18n } from "./desktop-i18n";
import { TauriFileOpenerAdapter } from "./platform/tauri-platform-adapters";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useStableAsyncData } from "./use-stable-async-data";
import { UiEmptyState } from "./ui/feedback";

// Adapter 没有 React 状态，可以在模块级复用；每次渲染重新 new 只会制造无意义对象。
const fileOpener = new TauriFileOpenerAdapter();

/** 作品库入口只负责创建入口与统一 WorkQuery 浏览器，不持有详情页状态。 */
export function DesktopWorksPage({
  repository,
  openWork,
  openPerson,
  onLibraryChanged,
  setMessage,
  initialQuery,
  initialState,
  onExplorerStateChange,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
  initialQuery?: WorkQuery;
  initialState?: DesktopWorkExplorerState;
  onExplorerStateChange?: (state: DesktopWorkExplorerState) => void;
}) {
  const { t } = useDesktopI18n();
  return (
    <div className="page-stack">
      <section className="page-title">
        <span className="eyebrow">CANONICAL WORKS · FACETED SEARCH · PRESENTATION PARITY</span>
        <h1>{t("作品库")}</h1>
        <p>{t("对齐 Web 的多维筛选：演员、导演、年份、作品类型、厂商、厂牌、系列、Genre、Tag、日期、时长、封面与本地媒体，并保留海报墙 / 列表 / 表格三种视图。")}</p>
      </section>
      <CreateWorkPanel repository={repository} onSaved={(work) => { onLibraryChanged(); openWork(work.id); }} setMessage={setMessage} />
      <DesktopWorkExplorer repository={repository} onOpen={openWork} onOpenPerson={openPerson} storageKey="localogue.desktop.work-view" initialQuery={initialQuery} initialState={initialState} onStateChange={onExplorerStateChange} />
    </div>
  );
}

/**
 * 作品详情把“读取聚合数据”和“用户可执行操作”收口在一个页面模块中。
 * React 只通过 Repository/Application 组件工作，不直接接触 JSON 路径或 Native 文件 API。
 */
export function DesktopWorkDetailPage({
  repository,
  id,
  onBack,
  openPerson,
  onLibraryChanged,
  setMessage,
  filterWorks,
}: {
  repository: TauriLibraryRepository;
  id: string;
  onBack: () => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
  filterWorks: (query: WorkQuery) => void;
}) {
  const { t, metadataLanguage, assetTypeLabel } = useDesktopI18n();
  const data = useStableAsyncData(async () => {
    const work = await repository.findWorkById(id);
    if (!work) return null;
    const [people, organizations, series, genres, tags, media, allAssets, presentationPreference, recycledAsset] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 99_999 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
      repository.listMediaFiles(work.id),
      repository.listAssets(),
      repository.findPresentationPreference("work", work.id),
      latestRecycledAsset(repository, "work", work.id),
    ]);
    const presentation = resolveWorkPresentation(work, allAssets, presentationPreference);
    const linkedAssetIds = new Set(work.assetIds);
    const assets = allAssets.filter((asset) => linkedAssetIds.has(asset.id) || (asset.subjectType === "work" && asset.subjectId === work.id));
    return {
      work,
      people: new Map(people.items.map((item) => [item.id, item])),
      organizations: new Map(organizations.map((item) => [item.id, item])),
      series: new Map(series.map((item) => [item.id, item])),
      genres: new Map(genres.map((item) => [item.id, item])),
      tags: new Map(tags.map((item) => [item.id, item])),
      media,
      assets,
      presentationPreference,
      presentation,
      recycledAsset,
    };
  }, [repository, id], toMessage);

  // 读取中、失效链接和 I/O 失败也必须保留返回入口，不能把用户困在空页面。
  if (data.loading) return <UiEmptyState busy title={t("正在读取资料库…")} />;
  if (data.error || !data.value) return <UiEmptyState tone="error" title={data.value === null ? t("作品不存在。") : t("无法读取资料库。")} description={data.error} />;
  const { work, people, organizations, series, genres, tags, media, assets, presentationPreference, presentation, recycledAsset } = data.value;
  const performers = work.personRelations.filter((item) => item.role === "performer");
  const directors = work.personRelations.filter((item) => item.role === "director");

  async function removePrivateAsset(asset: Asset): Promise<void> {
    try {
      const isPrivateAsset = await repository.isPrivateEntity("assets", asset.id);
      if (!isPrivateAsset) {
        setMessage(t("该 Asset 来自 Shared Pack，不能直接删除；Shared Pack 始终只读。"));
        return;
      }
      if (!window.confirm(t("从 {code} 移除这个 Private Asset 记录？\n\n{path}\n\n可以通过“恢复最近移除”找回；原图和管理副本均不会删除。", { code: work.code, path: asset.storagePath }))) return;
      await recyclePrivateAsset(repository, asset, work);
      setMessage(t("已从 {code} 移入图片回收站；原图和管理副本均未删除。", { code: work.code }));
      onLibraryChanged();
    } catch (error) {
      setMessage(t("删除 Asset 失败：{error}", { error: toMessage(error) }));
    }
  }

  async function restoreLastAsset(): Promise<void> {
    if (!recycledAsset) return;
    try {
      await restoreRecycledAsset(repository, recycledAsset);
      setMessage(t("已恢复最近移除的图片记录。"));
      onLibraryChanged();
    } catch (error) {
      setMessage(t("恢复图片失败：{error}", { error: toMessage(error) }));
    }
  }

  async function playMedia(path: string): Promise<void> {
    try {
      // openPath 进入受限 Native Command；Rust 会再次校验文件存在且扩展名属于支持的视频类型。
      await fileOpener.openPath(path);
    } catch (error) {
      setMessage(t("无法播放媒体：{error}", { error: toMessage(error) }));
    }
  }

  async function revealMedia(path: string): Promise<void> {
    try {
      // reveal 只让系统文件管理器选中文件，不执行目标文件。
      await fileOpener.revealInFolder(path);
    } catch (error) {
      setMessage(t("无法打开文件所在位置：{error}", { error: toMessage(error) }));
    }
  }

  async function revealAssetSource(path: string): Promise<void> {
    try {
      await fileOpener.revealInFolder(path);
    } catch (error) {
      setMessage(t("无法定位原始图片：{error}", { error: toMessage(error) }));
    }
  }

  const makerName = work.makerId ? localizeText(organizations.get(work.makerId)?.names, metadataLanguage, work.makerId) : undefined;
  const labelName = work.labelId ? localizeText(organizations.get(work.labelId)?.names, metadataLanguage, work.labelId) : undefined;
  const seriesNames = work.seriesIds.map((seriesId) => localizeText(series.get(seriesId)?.names, metadataLanguage, seriesId));
  const workTypeNames = work.workTypeIds.map((workTypeId) => {
    const definition = workTypeDefinition(workTypeId);
    return definition ? localizeText(definition.names, metadataLanguage, workTypeId) : workTypeId;
  });
  const genreNames = work.genreIds.map((genreId) => localizeGenre(genres.get(genreId), metadataLanguage, genreId));
  const tagNames = work.tagIds.map((tagId) => localizeText(tags.get(tagId)?.names, metadataLanguage, tagId));

  return (
    <div className="page-stack desktop-work-detail-page">
      <DesktopWorkAssetGallery assets={assets} workCode={work.code} mediaCount={media.length} assetTypeLabel={assetTypeLabel} />
      <section className="desktop-work-record desktop-work-record--stacked">
        <div className="desktop-work-record__content">
          <header className="desktop-work-record__header">
            <div className="desktop-work-record__headline">
              <span className="code-badge">{work.code}</span>
              <DesktopFavoriteButton workId={work.id} variant="detail" />
              <DesktopRatingControl workId={work.id} />
              <span className="desktop-work-record__summary-counts">
                <span>{t("本地媒体")} <strong>{media.length}</strong></span>
                <span>{t("作品图片")} <strong>{assets.length}</strong></span>
              </span>
            </div>
            <h1>{localizeText(work.titles, metadataLanguage, work.code)}</h1>
            <p>{localizeText(work.descriptions, metadataLanguage, t("暂无简介"))}</p>
          </header>
          <dl className="desktop-metadata-table">
            <DenseDetailRow label={t("发行日期")} value={work.releaseDate?.value} />
            <DenseDetailRow label={t("时长")} value={work.durationMinutes ? `${work.durationMinutes} ${t("分钟")}` : undefined} />
            <DenseDetailRow label={t("演员")}><DensePersonLinks relations={performers} people={people} language={metadataLanguage} onOpen={openPerson} /></DenseDetailRow>
            <DenseDetailRow label={t("导演")}><DensePersonLinks relations={directors} people={people} language={metadataLanguage} onOpen={openPerson} /></DenseDetailRow>
            <DenseDetailRow label={t("厂商")}><DenseFilterLinks items={work.makerId && makerName ? [{ id: work.makerId, label: makerName }] : []} onOpen={(id) => filterWorks({ makerIds: [id] })} /></DenseDetailRow>
            <DenseDetailRow label={t("厂牌")}><DenseFilterLinks items={work.labelId && labelName ? [{ id: work.labelId, label: labelName }] : []} onOpen={(id) => filterWorks({ labelIds: [id] })} /></DenseDetailRow>
            <DenseDetailRow label={t("系列")}><DenseFilterLinks items={work.seriesIds.map((id, index) => ({ id, label: seriesNames[index] }))} onOpen={(id) => filterWorks({ seriesIds: [id] })} /></DenseDetailRow>
            <DenseDetailRow label={t("作品类型")}><DenseFilterLinks items={work.workTypeIds.map((id, index) => ({ id, label: workTypeNames[index] }))} emphasis onOpen={(id) => filterWorks({ workTypeIds: [id] })} /></DenseDetailRow>
            <DenseDetailRow label={t("题材")}><DenseFilterLinks items={work.genreIds.map((id, index) => ({ id, label: genreNames[index] }))} onOpen={(id) => filterWorks({ genreIds: [id] })} /></DenseDetailRow>
            <DenseDetailRow label={t("标签")}><DenseFilterLinks items={work.tagIds.map((id, index) => ({ id, label: tagNames[index] }))} onOpen={(id) => filterWorks({ tagIds: [id] })} /></DenseDetailRow>
          </dl>
        </div>
      </section>
      <DesktopWorkMediaSection media={media} onPlay={(path) => void playMedia(path)} onReveal={(path) => void revealMedia(path)} />
      <PresentationAssetPicker entityType="work" entityId={work.id} candidates={presentation.candidates} preference={presentationPreference} resolved={presentation.resolved} stalePreferredAssetId={presentation.stalePreferredAssetId} repository={repository} onSaved={onLibraryChanged} setMessage={setMessage} />
      <WorkEditor key={work.id} repository={repository} work={work} onSaved={onLibraryChanged} onDeleted={() => { onLibraryChanged(); onBack(); }} setMessage={setMessage} />
      <section className="settings-card desktop-local-assets-section">
        <div className="section-heading">
          <div><span className="eyebrow">WORK ASSETS</span><h2>{t("作品图片资产")}</h2></div>
          <div className="button-row"><small className="muted">{t("{count} 个资产", { count: assets.length })}</small>{recycledAsset ? <button onClick={() => void restoreLastAsset()}>{t("恢复最近移除")}</button> : null}</div>
        </div>
        {assets.length ? (
          <div className="desktop-asset-management-list">
            {sortWorkAssetsForManagement(assets).map((asset) => (
              <article className="desktop-asset-management-row" key={asset.id}>
                <div><strong>{assetTypeLabel(asset.type)}</strong><span><code>{asset.type}</code> · {asset.mimeType ?? "local asset"}</span><code className="desktop-asset-management-path">{asset.storagePath}</code></div>
                <div className="button-row">
                  {asset.localSourcePath ? <button onClick={() => void revealAssetSource(asset.localSourcePath!)}>{t("定位原图")}</button> : null}
                  <button className="danger-button" onClick={() => void removePrivateAsset(asset)}>{t("移入回收站")}</button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="muted">{t("尚未关联本地图片资产。可在“本地资料”执行一键同步，将 Unified Root 中的 poster / fanart / thumb 导入。")}</p>}
      </section>
    </div>
  );
}

function DenseDetailRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return <div className="desktop-metadata-row"><dt>{label}</dt><dd>{children ?? (value && value !== "—" ? value : "—")}</dd></div>;
}

/** 关系按钮只生成 WorkQuery 入口，筛选语义继续由共享 queryWorks 统一处理。 */
function DenseFilterLinks({ items, onOpen, emphasis = false }: { items: Array<{ id: string; label: string }>; onOpen: (id: string) => void; emphasis?: boolean }) {
  const visible = items.filter((item) => item.label && item.label !== "—");
  if (!visible.length) return <>—</>;
  return <span className="desktop-inline-entity-links">{visible.map((item) => <button className={emphasis ? "is-strong" : ""} key={item.id} onClick={() => onOpen(item.id)} type="button">{item.label}</button>)}</span>;
}

function DensePersonLinks({ relations, people, language, onOpen }: { relations: Work["personRelations"]; people: Map<string, Person>; language: "ja" | "zh-CN" | "en"; onOpen: (id: string) => void }) {
  if (!relations.length) return <>—</>;
  return <span className="desktop-inline-entity-links">{relations.map((relation) => {
    const person = people.get(relation.personId);
    const label = person ? getPreferredPersonName(person, language) : relation.personId;
    return <button key={`${relation.role}:${relation.personId}`} onClick={() => onOpen(relation.personId)} type="button">{label}</button>;
  })}</span>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}
