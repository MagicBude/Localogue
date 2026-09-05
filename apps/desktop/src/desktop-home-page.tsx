import type { ReactNode } from "react";

import type { Asset } from "@/domain/entities/asset";

import { useDesktopI18n } from "./desktop-i18n";
import { DesktopPersonCard } from "./desktop-person-explorer";
import { resolvePersonPresentation } from "./desktop-presentation";
import { buildDesktopWorkCards, DesktopWorkResults } from "./desktop-work-results";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useStableAsyncData } from "./use-stable-async-data";

/**
 * Desktop 首页只组合资料库摘要和最近内容。
 * 全部 Works 只读取一次：同一份结果同时计算总数、人物作品数和最近作品，避免 JSON Repository 重复扫描。
 */
export function DesktopHomePage({
  repository,
  openWork,
  openPerson,
  openWorks,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  openWorks: () => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const data = useStableAsyncData(async () => {
    const [works, people, organizations, series, media, assets, preferences] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 100_000, sort: "release_desc" }),
      repository.listPeople({ page: 1, pageSize: 100_000, sort: "name_asc" }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listMediaFiles(),
      repository.listAssets(),
      repository.listPresentationPreferences(),
    ]);
    const recentWorks = works.items.slice(0, 12);
    const performerIds = new Set(recentWorks.flatMap((work) => work.personRelations.filter((relation) => relation.role === "performer").map((relation) => relation.personId)));
    const featuredPeople = people.items.filter((person) => performerIds.has(person.id)).slice(0, 6);
    const workCounts = new Map<string, number>();
    for (const work of works.items) {
      for (const personId of new Set(work.personRelations.filter((relation) => relation.role === "performer").map((relation) => relation.personId))) {
        workCounts.set(personId, (workCounts.get(personId) ?? 0) + 1);
      }
    }
    const portraitByPersonId = new Map<string, Asset>();
    const preferenceByPersonId = new Map(preferences.filter((item) => item.entityType === "person").map((item) => [item.entityId, item]));
    for (const person of featuredPeople) {
      const portrait = resolvePersonPresentation(person, assets, preferenceByPersonId.get(person.id)).resolved;
      if (portrait) portraitByPersonId.set(person.id, portrait);
    }
    return {
      works,
      people,
      organizations,
      series,
      media,
      featuredPeople,
      workCounts,
      portraitByPersonId,
      recentCards: buildDesktopWorkCards(recentWorks, people.items, organizations, assets, metadataLanguage, preferences),
    };
  }, [repository, metadataLanguage], toMessage);

  if (data.loading) return <div className="empty-state"><span className="spinner" />{t("正在读取资料库…")}</div>;
  if (data.error || !data.value) return <div className="empty-state error-state">{data.error ?? t("无法读取资料库。")}</div>;
  const { works, people, organizations, series, media, featuredPeople, recentCards, workCounts, portraitByPersonId } = data.value;

  return (
    <div className="page-stack">
      <section className="hero-panel desktop-hero">
        <span className="eyebrow">LOCAL-FIRST · CURATION · EXPLORATION</span>
        <h1>{t("你的 Localogue，现在就在桌面端。")}</h1>
        <p>{t("V1-24 把 Private Presentation Preference 接入 Desktop；封面与头像选择不再改写 Canonical / Shared Pack。")}</p>
      </section>
      <section className="stat-grid">
        <Stat label={t("作品")} value={works.total} note="Canonical" />
        <Stat label={t("人物")} value={people.total} note="Canonical" />
        <Stat label={t("厂商")} value={organizations.filter((item) => item.kind === "maker").length} note="Organizations" />
        <Stat label={t("系列")} value={series.length} note="Canonical" />
        <Stat label={t("媒体")} value={media.length} note="Private" />
      </section>
      <SectionTitle
        eyebrow="RECENT WORKS"
        title={t("最近作品")}
        action={<button className="ghost-button" onClick={openWorks} type="button">{t("查看全部作品")}</button>}
      />
      <DesktopWorkResults cards={recentCards} view="grid" onOpen={openWork} />
      {featuredPeople.length ? <>
        <SectionTitle eyebrow="PEOPLE" title={t("相关人物")} />
        <div className="desktop-person-grid desktop-home-people-grid">
          {featuredPeople.map((person) => <DesktopPersonCard key={person.id} person={person} portrait={portraitByPersonId.get(person.id)} workCount={workCounts.get(person.id) ?? 0} onOpen={() => openPerson(person.id)} />)}
        </div>
      </> : null}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}
