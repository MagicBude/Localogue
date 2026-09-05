import type { ReactNode } from "react";

import { workTypeDefinition } from "@/application/importers/import-classification-normalizer";
import { localizeGenre } from "@/application/services/genre-localization-service";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";

import { CreateWorkPanel, WorkEditor } from "./desktop-management";
import { PresentationAssetPicker } from "./desktop-presentation-workbench";
import { resolveWorkPresentation } from "./desktop-presentation";
import { DesktopWorkAssetGallery } from "./desktop-work-asset-gallery";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { useDesktopI18n } from "./desktop-i18n";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useStableAsyncData } from "./use-stable-async-data";

/** 作品库入口只负责创建入口与统一 WorkQuery 浏览器，不持有详情页状态。 */
export function DesktopWorksPage({
  repository,
  openWork,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
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
      <DesktopWorkExplorer repository={repository} onOpen={openWork} storageKey="localogue.desktop.work-view" />
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
}: {
  repository: TauriLibraryRepository;
  id: string;
  onBack: () => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t, metadataLanguage, assetTypeLabel } = useDesktopI18n();
  const data = useStableAsyncData(async () => {
    const work = await repository.findWorkById(id);
    if (!work) return null;
    const [people, organizations, series, genres, tags, media, allAssets, presentationPreference] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 99_999 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
      repository.listMediaFiles(work.id),
      repository.listAssets(),
      repository.findPresentationPreference("work", work.id),
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
    };
  }, [repository, id], toMessage);

  if (data.loading) return <PageState>{t("正在读取资料库…")}</PageState>;
  if (data.error || !data.value) return <PageState error>{data.value === null ? t("作品不存在。") : data.error}</PageState>;
  const { work, people, organizations, series, genres, tags, media, assets, presentationPreference, presentation } = data.value;
  const performers = work.personRelations.filter((item) => item.role === "performer");
  const directors = work.personRelations.filter((item) => item.role === "director");

  async function removePrivateAsset(assetId: string, storagePath: string): Promise<void> {
    try {
      const isPrivateAsset = await repository.isPrivateEntity("assets", assetId);
      if (!isPrivateAsset) {
        setMessage(t("该 Asset 来自 Shared Pack，不能直接删除；Shared Pack 始终只读。"));
        return;
      }
      if (!window.confirm(t("从 {code} 解除并删除这个 Private Asset 元数据？\n\n{path}\n\n原始图片与 content-addressed 文件不会由 Desktop 自动物理删除。", { code: work.code, path: storagePath }))) return;
      const nextWork: Work = { ...work, assetIds: work.assetIds.filter((value) => value !== assetId), updatedAt: new Date().toISOString() };
      await repository.saveWork(nextWork);
      try {
        await repository.deletePrivateAsset(assetId);
      } catch (error) {
        await repository.saveWork(work);
        throw error;
      }
      setMessage(t("已从 {code} 解除并删除 Private Asset 元数据；图片文件保留。", { code: work.code }));
      onLibraryChanged();
    } catch (error) {
      setMessage(t("删除 Asset 失败：{error}", { error: toMessage(error) }));
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
      <button className="back-button" onClick={onBack}>← {t("返回作品库")}</button>
      <DesktopWorkAssetGallery assets={assets} workCode={work.code} mediaCount={media.length} assetTypeLabel={assetTypeLabel} />
      <section className="desktop-work-record desktop-work-record--stacked">
        <div className="desktop-work-record__content">
          <header className="desktop-work-record__header">
            <div className="desktop-work-record__headline">
              <span className="code-badge">{work.code}</span>
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
            <DenseDetailRow label={t("厂商")} value={makerName} />
            <DenseDetailRow label={t("厂牌")} value={labelName} />
            <DenseDetailRow label={t("系列")}><DenseChips values={seriesNames} /></DenseDetailRow>
            <DenseDetailRow label={t("作品类型")}><DenseChips values={workTypeNames} emphasis /></DenseDetailRow>
            <DenseDetailRow label={t("题材")}><DenseChips values={genreNames} /></DenseDetailRow>
            <DenseDetailRow label={t("标签")}><DenseChips values={tagNames} /></DenseDetailRow>
          </dl>
        </div>
      </section>
      <PresentationAssetPicker entityType="work" entityId={work.id} candidates={presentation.candidates} preference={presentationPreference} resolved={presentation.resolved} stalePreferredAssetId={presentation.stalePreferredAssetId} repository={repository} onSaved={onLibraryChanged} setMessage={setMessage} />
      <WorkEditor repository={repository} work={work} onSaved={onLibraryChanged} onDeleted={() => { onLibraryChanged(); onBack(); }} setMessage={setMessage} />
      <section className="settings-card desktop-local-assets-section">
        <div className="section-heading">
          <div><span className="eyebrow">WORK ASSETS</span><h2>{t("作品图片资产")}</h2></div>
          <small className="muted">{t("{count} 个资产", { count: assets.length })}</small>
        </div>
        {assets.length ? (
          <div className="desktop-asset-management-list">
            {sortWorkAssets(assets).map((asset) => (
              <article className="desktop-asset-management-row" key={asset.id}>
                <div><strong>{assetTypeLabel(asset.type)}</strong><span><code>{asset.type}</code> · {asset.mimeType ?? "local asset"}</span><code className="desktop-asset-management-path">{asset.storagePath}</code></div>
                <button className="danger-button" onClick={() => void removePrivateAsset(asset.id, asset.storagePath)}>{t("解除 / 删除")}</button>
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

function DenseChips({ values, emphasis = false }: { values: string[]; emphasis?: boolean }) {
  const visible = values.filter((value) => value && value !== "—");
  if (!visible.length) return <>—</>;
  return <span className="desktop-dense-chips">{visible.map((value) => <span className={emphasis ? "desktop-dense-chip is-strong" : "desktop-dense-chip"} key={value}>{value}</span>)}</span>;
}

function DensePersonLinks({ relations, people, language, onOpen }: { relations: Work["personRelations"]; people: Map<string, Person>; language: "ja" | "zh-CN" | "en"; onOpen: (id: string) => void }) {
  if (!relations.length) return <>—</>;
  return <span className="desktop-inline-entity-links">{relations.map((relation) => {
    const person = people.get(relation.personId);
    const label = person ? getPreferredPersonName(person, language) : relation.personId;
    return <button key={`${relation.role}:${relation.personId}`} onClick={() => onOpen(relation.personId)} type="button">{label}</button>;
  })}</span>;
}

function sortWorkAssets(assets: Asset[]): Asset[] {
  const priority: Record<Asset["type"], number> = { poster: 0, fanart: 1, screenshot: 2, cover: 3, gallery: 4, portrait: 5, logo: 6, subtitle: 7, document: 8, other: 9 };
  return [...assets].sort((a, b) => priority[a.type] - priority[b.type] || a.id.localeCompare(b.id));
}

function PageState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? "empty-state error-state" : "empty-state"}>{children}</div>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}
