import { useEffect, useMemo, useState } from "react";

import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { PresentationPreference } from "@/domain/entities/presentation-preference";
import type { Work } from "@/domain/entities/work";

import { DesktopAssetImage } from "./desktop-asset-image";
import { useDesktopI18n } from "./desktop-i18n";
import {
  makePresentationPreferenceId,
  personPresentationCandidates,
  resolvePersonPresentation,
  resolveWorkPresentation,
  workPresentationCandidates,
} from "./desktop-presentation";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";

interface PresentationWorkbenchProps {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}

type PresentationMode = "work" | "person";

interface WorkbenchData {
  works: Work[];
  people: Person[];
  assets: Asset[];
  preferences: PresentationPreference[];
}

export function DesktopPresentationWorkbench({
  repository,
  openWork,
  openPerson,
  onLibraryChanged,
  setMessage,
}: PresentationWorkbenchProps) {
  const { t, metadataLanguage, assetTypeLabel } = useDesktopI18n();
  const [mode, setMode] = useState<PresentationMode>("work");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const [works, people, assets, preferences] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 100000, sort: "release_desc" }),
      repository.listPeople({ page: 1, pageSize: 100000, sort: "name_asc" }),
      repository.listAssets(),
      repository.listPresentationPreferences(),
    ]);
    setData({ works: works.items, people: people.items, assets, preferences });
    setError(null);
  }

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      repository.listWorks({ page: 1, pageSize: 100000, sort: "release_desc" }),
      repository.listPeople({ page: 1, pageSize: 100000, sort: "name_asc" }),
      repository.listAssets(),
      repository.listPresentationPreferences(),
    ]).then(([works, people, assets, preferences]) => {
      if (!disposed) {
        setData({ works: works.items, people: people.items, assets, preferences });
        setError(null);
      }
    }).catch((value) => {
      if (!disposed) setError(message(value));
    });
    return () => { disposed = true; };
  }, [repository]);

  const preferenceByEntity = useMemo(
    () => new Map((data?.preferences ?? []).map((item) => [`${item.entityType}:${item.entityId}`, item])),
    [data?.preferences],
  );

  const stats = useMemo(() => {
    if (!data) return { explicit: 0, stale: 0, selectableWorks: 0, selectablePeople: 0 };
    let stale = 0;
    for (const preference of data.preferences) {
      if (preference.entityType === "work") {
        const work = data.works.find((item) => item.id === preference.entityId);
        if (work && resolveWorkPresentation(work, data.assets, preference).stalePreferredAssetId) stale += 1;
      } else {
        const person = data.people.find((item) => item.id === preference.entityId);
        if (person && resolvePersonPresentation(person, data.assets, preference).stalePreferredAssetId) stale += 1;
      }
    }
    return {
      explicit: data.preferences.filter((item) => item.preferredCoverAssetId || item.preferredPortraitAssetId).length,
      stale,
      selectableWorks: data.works.filter((work) => workPresentationCandidates(work, data.assets).length > 0).length,
      selectablePeople: data.people.filter((person) => personPresentationCandidates(person, data.assets).length > 0).length,
    };
  }, [data]);

  async function savePreference(entityType: PresentationMode, entityId: string, assetId?: string): Promise<void> {
    const previous = preferenceByEntity.get(`${entityType}:${entityId}`);
    const preference: PresentationPreference = {
      ...(previous ?? {}),
      schemaVersion: 1,
      id: makePresentationPreferenceId(entityType, entityId),
      entityType,
      entityId,
      ...(entityType === "work"
        ? { preferredCoverAssetId: assetId || undefined }
        : { preferredPortraitAssetId: assetId || undefined }),
      updatedAt: new Date().toISOString(),
    };
    setBusyId(`${entityType}:${entityId}`);
    try {
      await repository.savePresentationPreference(preference);
      await reload();
      onLibraryChanged();
      setMessage(assetId
        ? t("已保存私人展示偏好；Canonical / Shared Pack 数据没有被修改。")
        : t("已恢复默认展示；Canonical / Shared Pack 数据没有被修改。"));
    } catch (value) {
      setMessage(t("保存展示偏好失败：{error}", { error: message(value) }));
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <section className="settings-card"><h2>{t("Presentation 读取失败")}</h2><p className="muted">{error}</p></section>;
  if (!data) return <section className="settings-card"><h2>{t("正在读取展示偏好…")}</h2></section>;

  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase();
  const works = data.works.filter((work) => {
    if (!normalizedQuery) return true;
    return `${work.code} ${Object.values(work.titles).join(" ")}`.normalize("NFKC").toLocaleLowerCase().includes(normalizedQuery);
  });
  const people = data.people.filter((person) => {
    if (!normalizedQuery) return true;
    return person.names.some((name) => name.value.normalize("NFKC").toLocaleLowerCase().includes(normalizedQuery));
  });

  return (
    <section className="settings-card desktop-presentation-workbench">
      <div className="section-heading desktop-presentation-heading">
        <div>
          <span className="eyebrow">PRESENTATION · PRIVATE PREFERENCE</span>
          <h2>{t("展示偏好")}</h2>
          <p className="muted">{t("这里只决定你自己的 Localogue 显示哪张图，不改写 Canonical，也不会写回 Shared Pack。")}</p>
        </div>
        <div className="desktop-presentation-metrics">
          <span>{t("已设置")} <strong>{stats.explicit}</strong></span>
          <span className={stats.stale ? "is-warning" : undefined}>{t("失效")} <strong>{stats.stale}</strong></span>
        </div>
      </div>

      <div className="desktop-presentation-toolbar">
        <div className="desktop-segmented-control" role="tablist" aria-label={t("展示偏好实体类型")}>
          <button className={mode === "work" ? "is-active" : undefined} onClick={() => setMode("work")} type="button">{t("作品")} · {stats.selectableWorks}</button>
          <button className={mode === "person" ? "is-active" : undefined} onClick={() => setMode("person")} type="button">{t("人物")} · {stats.selectablePeople}</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "work" ? t("搜索番号或标题") : t("搜索姓名 / 别名 / 旧艺名")} type="search" />
      </div>

      <div className="desktop-presentation-list">
        {mode === "work" ? works.map((work) => {
          const preference = preferenceByEntity.get(`work:${work.id}`);
          const resolution = resolveWorkPresentation(work, data.assets, preference);
          if (!resolution.candidates.length && !preference?.preferredCoverAssetId) return null;
          const busy = busyId === `work:${work.id}`;
          return (
            <article className="desktop-presentation-row" key={work.id}>
              <span className="desktop-presentation-preview is-work"><DesktopAssetImage asset={resolution.resolved} fallback={<span>{work.code}</span>} /></span>
              <div className="desktop-presentation-identity">
                <strong>{work.code}</strong>
                <span>{localizeText(work.titles, metadataLanguage, work.code)}</span>
                <PresentationStatus staleId={resolution.stalePreferredAssetId} explicit={Boolean(preference?.preferredCoverAssetId)} />
              </div>
              <label>
                <span>{t("首选封面")}</span>
                <select disabled={busy} value={preference?.preferredCoverAssetId ?? ""} onChange={(event) => void savePreference("work", work.id, event.target.value || undefined)}>
                  <option value="">{t("自动 / Canonical 默认")}</option>
                  {resolution.candidates.map((asset) => <option key={asset.id} value={asset.id}>{assetTypeLabel(asset.type)} · {shortAssetId(asset.id)}</option>)}
                  {resolution.stalePreferredAssetId ? <option value={resolution.stalePreferredAssetId}>{t("失效引用")} · {shortAssetId(resolution.stalePreferredAssetId)}</option> : null}
                </select>
              </label>
              <button className="ghost-button" onClick={() => openWork(work.id)} type="button">{t("打开 Work")}</button>
            </article>
          );
        }) : people.map((person) => {
          const preference = preferenceByEntity.get(`person:${person.id}`);
          const resolution = resolvePersonPresentation(person, data.assets, preference);
          if (!resolution.candidates.length && !preference?.preferredPortraitAssetId) return null;
          const busy = busyId === `person:${person.id}`;
          const name = getPreferredPersonName(person, metadataLanguage);
          return (
            <article className="desktop-presentation-row" key={person.id}>
              <span className="desktop-presentation-preview is-person"><DesktopAssetImage asset={resolution.resolved} fallback={<span>{name.slice(0, 1)}</span>} /></span>
              <div className="desktop-presentation-identity">
                <strong>{name}</strong>
                <span>{person.names.find((item) => item.value !== name)?.value ?? person.id}</span>
                <PresentationStatus staleId={resolution.stalePreferredAssetId} explicit={Boolean(preference?.preferredPortraitAssetId)} />
              </div>
              <label>
                <span>{t("首选头像")}</span>
                <select disabled={busy} value={preference?.preferredPortraitAssetId ?? ""} onChange={(event) => void savePreference("person", person.id, event.target.value || undefined)}>
                  <option value="">{t("自动 / Canonical 默认")}</option>
                  {resolution.candidates.map((asset) => <option key={asset.id} value={asset.id}>{assetTypeLabel(asset.type)} · {shortAssetId(asset.id)}</option>)}
                  {resolution.stalePreferredAssetId ? <option value={resolution.stalePreferredAssetId}>{t("失效引用")} · {shortAssetId(resolution.stalePreferredAssetId)}</option> : null}
                </select>
              </label>
              <button className="ghost-button" onClick={() => openPerson(person.id)} type="button">{t("打开 Person")}</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function PresentationAssetPicker({
  entityType,
  entityId,
  candidates,
  preference,
  resolved,
  stalePreferredAssetId,
  repository,
  onSaved,
  setMessage,
}: {
  entityType: PresentationMode;
  entityId: string;
  candidates: Asset[];
  preference?: PresentationPreference | null;
  resolved?: Asset;
  stalePreferredAssetId?: string;
  repository: TauriLibraryRepository;
  onSaved: () => void;
  setMessage: (message: string) => void;
}) {
  const { t, assetTypeLabel } = useDesktopI18n();
  const [busy, setBusy] = useState(false);
  const preferredId = entityType === "work" ? preference?.preferredCoverAssetId : preference?.preferredPortraitAssetId;

  async function save(assetId?: string): Promise<void> {
    const next: PresentationPreference = {
      ...(preference ?? {}),
      schemaVersion: 1,
      id: makePresentationPreferenceId(entityType, entityId),
      entityType,
      entityId,
      ...(entityType === "work"
        ? { preferredCoverAssetId: assetId || undefined }
        : { preferredPortraitAssetId: assetId || undefined }),
      updatedAt: new Date().toISOString(),
    };
    setBusy(true);
    try {
      await repository.savePresentationPreference(next);
      setMessage(assetId
        ? t("已保存私人展示偏好；Canonical / Shared Pack 数据没有被修改。")
        : t("已恢复默认展示；Canonical / Shared Pack 数据没有被修改。"));
      onSaved();
    } catch (value) {
      setMessage(t("保存展示偏好失败：{error}", { error: message(value) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card desktop-presentation-picker">
      <div className="section-heading">
        <div><span className="eyebrow">PRIVATE PRESENTATION</span><h2>{entityType === "work" ? t("首选封面") : t("首选头像")}</h2></div>
        {stalePreferredAssetId ? <span className="desktop-presentation-warning">{t("当前偏好已失效")}</span> : preferredId ? <span className="status-chip">{t("私人偏好")}</span> : <span className="muted">{t("自动 / Canonical 默认")}</span>}
      </div>
      <p className="muted">{t("选择只保存在 Private Library 的 presentation-preferences 中；公共实体与 Shared Pack 保持不变。")}</p>
      <div className="desktop-presentation-picker__current">
        <span className={entityType === "work" ? "desktop-presentation-preview is-work" : "desktop-presentation-preview is-person"}>
          <DesktopAssetImage asset={resolved} fallback={<span>—</span>} />
        </span>
        <div>
          <strong>{resolved ? `${assetTypeLabel(resolved.type)} · ${shortAssetId(resolved.id)}` : t("暂无可用图片")}</strong>
          <small>{preferredId ? t("当前由私人偏好决定") : t("当前使用自动回退规则")}</small>
        </div>
      </div>
      {candidates.length ? (
        <div className="desktop-presentation-candidates">
          {candidates.map((asset) => (
            <button className={preferredId === asset.id ? "is-active" : undefined} disabled={busy} key={asset.id} onClick={() => void save(asset.id)} type="button">
              <span><DesktopAssetImage asset={asset} fallback={<span>—</span>} /></span>
              <small>{assetTypeLabel(asset.type)}</small>
              <code>{shortAssetId(asset.id)}</code>
            </button>
          ))}
        </div>
      ) : <p className="muted">{t("当前实体没有可作为展示首图的 Asset。")}</p>}
      <div className="button-row">
        <button disabled={busy || !preferredId} onClick={() => void save(undefined)} type="button">{t("恢复默认")}</button>
      </div>
    </section>
  );
}

function PresentationStatus({ staleId, explicit }: { staleId?: string; explicit: boolean }) {
  const { t } = useDesktopI18n();
  if (staleId) return <small className="desktop-presentation-warning">{t("失效偏好")} · {shortAssetId(staleId)}</small>;
  if (explicit) return <small className="status-chip">{t("私人偏好")}</small>;
  return <small className="muted">{t("默认显示")}</small>;
}

function shortAssetId(value: string): string {
  return value.length > 24 ? `${value.slice(0, 21)}…` : value;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
