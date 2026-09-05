import { useEffect, useState } from "react";

import { buildCurationOverview } from "@/application/curation/curation-service";
import type { DuplicateCandidate } from "@/domain/entities/duplicate-candidate";

import { useDesktopI18n } from "./desktop-i18n";
import { DesktopPresentationWorkbench } from "./desktop-presentation-workbench";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";

/**
 * Curation 只消费可重算的完整度与重复候选，不把这些派生信号写回 Canonical。
 * Presentation Workbench 的写入也通过自己的 Application/Repository 边界完成。
 */
export function DesktopCurationPage({ repository, openWork, openPerson, onLibraryChanged, setMessage }: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (value: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [mode, setMode] = useState<"overview" | "presentation">("overview");
  const [data, setData] = useState<Awaited<ReturnType<typeof buildCurationOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "overview") return;
    let disposed = false;
    void buildCurationOverview(repository)
      .then((value) => { if (!disposed) { setData(value); setError(null); } })
      .catch((value) => { if (!disposed) setError(toMessage(value)); });
    return () => { disposed = true; };
  }, [repository, mode]);

  return <div className="page-stack governance-page">
    <header className="governance-title"><span className="eyebrow">CURATION · COMPLETENESS · PRESENTATION</span><h1>{t("资料治理")}</h1><p>{t("完整度、重复候选与私人展示偏好都在这里治理；Presentation 只影响当前 Private Library 的显示选择。")}</p></header>
    <div className="desktop-segmented-control governance-subnav" role="tablist" aria-label={t("治理视图")}><button className={mode === "overview" ? "is-active" : undefined} onClick={() => setMode("overview")} type="button">{t("完整度 / 重复")}</button><button className={mode === "presentation" ? "is-active" : undefined} onClick={() => setMode("presentation")} type="button">{t("展示偏好")}</button></div>
    {mode === "presentation" ? <DesktopPresentationWorkbench repository={repository} openWork={openWork} openPerson={openPerson} onLibraryChanged={onLibraryChanged} setMessage={setMessage} /> : error ? <EmptyState title={t("Curation 读取失败")} body={error} /> : !data ? <EmptyState title={t("正在计算资料完整度")} body={t("正在分析 Work / Person 完整度与重复候选…")} /> : <>
      <div className="governance-metrics governance-metrics--wide"><Metric label={t("Work 待完善")} value={data.stats.worksNeedingAttention} /><Metric label={t("Person 待完善")} value={data.stats.peopleNeedingAttention} /><Metric label={t("Work 重复候选")} value={data.stats.duplicateWorks} /><Metric label={t("Person 重复候选")} value={data.stats.duplicatePeople} /></div>
      <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">LOW COMPLETENESS</span><h2>{t("优先完善的作品")}</h2></div></div><div className="curation-list">{data.works.slice(0, 80).map(({ work, completeness }) => <button key={work.id} onClick={() => openWork(work.id)}><span><b>{work.code}</b><small>{Object.values(work.titles)[0] ?? work.id}</small></span><strong>{completeness.score}%</strong><small>{completeness.missingIds.join(" · ") || "complete"}</small></button>)}</div></section>
      <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">PEOPLE</span><h2>{t("优先完善的人物")}</h2></div></div><div className="curation-list">{data.people.slice(0, 80).map(({ person, completeness }) => <button key={person.id} onClick={() => openPerson(person.id)}><span><b>{person.names[0]?.value ?? person.id}</b></span><strong>{completeness.score}%</strong><small>{completeness.missingIds.join(" · ") || "complete"}</small></button>)}</div></section>
      <DuplicateList title={t("Work 重复候选")} items={data.duplicateWorks} /><DuplicateList title={t("Person 重复候选")} items={data.duplicatePeople} />
    </>}
  </div>;
}

function EmptyState({ title, body }: { title: string; body: string }) { return <section className="settings-card governance-empty"><h2>{title}</h2><p className="muted">{body}</p></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="governance-metric"><span>{label}</span><strong>{value}</strong></div>; }
function DuplicateList({ title, items }: { title: string; items: DuplicateCandidate[] }) { const { t } = useDesktopI18n(); return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">DUPLICATES</span><h2>{title}</h2></div><strong>{items.length}</strong></div>{items.length ? <div className="duplicate-list">{items.slice(0, 80).map((item) => <div key={item.id}><code>{item.leftId}</code><span>↔</span><code>{item.rightId}</code><b>{item.confidence}</b><small>{item.reasonIds.join(" · ")}</small></div>)}</div> : <p className="muted">{t("没有发现重复候选。")}</p>}</section>; }
function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
