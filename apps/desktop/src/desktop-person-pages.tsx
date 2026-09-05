import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";

import { DesktopAssetImage } from "./desktop-asset-image";
import { useDesktopI18n } from "./desktop-i18n";
import { CreatePersonPanel, PersonEditor } from "./desktop-management";
import { PersonAssetGovernance } from "./desktop-person-asset-governance";
import { DesktopPersonExplorer } from "./desktop-person-explorer";
import { resolvePersonPresentation } from "./desktop-presentation";
import { PresentationAssetPicker } from "./desktop-presentation-workbench";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useStableAsyncData } from "./use-stable-async-data";

/** 人物库入口与人物详情分离，筛选语义继续由共享 PersonQuery 实现。 */
export function DesktopPeoplePage({
  repository,
  openPerson,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  return (
    <div className="page-stack">
      <section className="page-title">
        <span className="eyebrow">PEOPLE · PROFILE · ADVANCED FILTER</span>
        <h1>{t("人物库")}</h1>
        <p>{t("对齐 Web 的人物高级筛选：姓名 / 别名、活动状态、出道年份、引退年份、出生年份、身高区间和排序；人物库仍按有 performer 作品关系的人物收口。")}</p>
      </section>
      <CreatePersonPanel repository={repository} onSaved={(person) => { onLibraryChanged(); openPerson(person.id); }} setMessage={setMessage} />
      <DesktopPersonExplorer repository={repository} onOpen={openPerson} />
    </div>
  );
}

/**
 * 人物详情集中管理人物事实、图片 Presentation 和相关作品查询。
 * Asset 导入与删除仍通过专用治理组件，详情页不直接调用 Native 文件命令。
 */
export function DesktopPersonDetailPage({
  repository,
  id,
  onBack,
  openWork,
  onLibraryChanged,
  setMessage,
  runtimeContractRevision,
}: {
  repository: TauriLibraryRepository;
  id: string;
  onBack: () => void;
  openWork: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
  runtimeContractRevision: number;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const data = useStableAsyncData(async () => {
    const person = await repository.findPersonById(id);
    if (!person) return null;
    const [workCount, assets, presentationPreference] = await Promise.all([
      repository.listWorks({ personIds: [id], page: 1, pageSize: 1 }),
      repository.listAssets(),
      repository.findPresentationPreference("person", person.id),
    ]);
    const presentation = resolvePersonPresentation(person, assets, presentationPreference);
    return {
      person,
      workCount: workCount.total,
      portrait: presentation.resolved,
      presentationPreference,
      presentation,
      personAssets: presentation.candidates,
    };
  }, [repository, id], toMessage);

  if (data.loading) return <PageState>{t("正在读取资料库…")}</PageState>;
  if (data.error || !data.value) return <PageState error>{data.value === null ? t("人物不存在。") : data.error}</PageState>;
  const { person, workCount, portrait, presentationPreference, presentation, personAssets } = data.value;
  const displayName = getPreferredPersonName(person, metadataLanguage);

  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>← {t("返回人物库")}</button>
      <section className="detail-hero person-detail-hero desktop-person-detail-hero">
        <div className="desktop-person-detail-portrait">
          <DesktopAssetImage asset={portrait} alt={`${displayName} portrait`} fallback={<span className="avatar-placeholder">{displayName.slice(0, 1)}</span>} />
        </div>
        <div className="desktop-person-detail-copy">
          <span className="status-chip">{person.activityStatus}</span>
          <h1>{displayName}</h1>
          <p>{localizeText(person.biographies, metadataLanguage, t("暂无人物简介"))}</p>
        </div>
      </section>
      <PersonAssetGovernance person={person} assets={personAssets} resolved={portrait} repository={repository} runtimeContractRevision={runtimeContractRevision} onLibraryChanged={onLibraryChanged} setMessage={setMessage} />
      <PresentationAssetPicker entityType="person" entityId={person.id} candidates={presentation.candidates} preference={presentationPreference} resolved={presentation.resolved} stalePreferredAssetId={presentation.stalePreferredAssetId} repository={repository} onSaved={onLibraryChanged} setMessage={setMessage} />
      <PersonEditor repository={repository} person={person} onSaved={onLibraryChanged} onDeleted={() => { onLibraryChanged(); onBack(); }} setMessage={setMessage} />
      <section className="detail-grid">
        <InfoCard label={t("出生日期")} value={person.birthDate?.value} />
        <InfoCard label={t("出生地")} value={localizeText(person.birthPlace, metadataLanguage)} />
        <InfoCard label={t("身高")} value={person.heightCm ? `${person.heightCm} cm` : undefined} />
        <InfoCard label={t("作品数")} value={String(workCount)} />
      </section>
      <section className="settings-card">
        <span className="eyebrow">NAMES</span>
        <h2>{t("名称 / 别名")}</h2>
        <div className="name-list">
          {person.names.map((name, index) => (
            <div key={`${name.language}-${name.type}-${index}`}><span>{name.language} · {name.type}</span><strong>{name.value}</strong></div>
          ))}
        </div>
      </section>
      <div className="section-heading"><div><span className="eyebrow">RELATED WORKS · FACETED SEARCH</span><h2>{t("相关作品")}</h2></div></div>
      <DesktopWorkExplorer repository={repository} onOpen={openWork} fixedPersonId={id} storageKey="localogue.desktop.person-related-work-view" />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return <article className="info-card"><span>{label}</span><strong>{value || "—"}</strong></article>;
}

function PageState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? "empty-state error-state" : "empty-state"}>{children}</div>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}
import type { ReactNode } from "react";
