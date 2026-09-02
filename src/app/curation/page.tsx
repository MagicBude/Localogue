import type { Metadata } from "next";
import Link from "next/link";

import { buildCurationOverview } from "@/application/curation/curation-service";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import { getCurationDictionary } from "@/i18n/curation";
import { listEvidenceLifecycles } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { listEvidenceRecords } from "@/infrastructure/evidence/evidence-store";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "资料整理" };

export default async function CurationPage() {
  const preferences = await getUserPreferences();
  const text = getCurationDictionary(preferences.uiLanguage);
  const [overview, evidence, lifecycles] = await Promise.all([
    buildCurationOverview(libraryRepository),
    listEvidenceRecords(),
    listEvidenceLifecycles(),
  ]);
  const lifecycleMap = new Map(lifecycles.map((item) => [item.evidenceId, item.status]));
  const pendingEvidence = evidence.filter(
    (item) => (lifecycleMap.get(item.id) ?? "pending") === "pending",
  ).length;
  const ignoredEvidence = evidence.filter(
    (item) => lifecycleMap.get(item.id) === "ignored",
  ).length;

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · QUALITY · DUPLICATES</span>
          <h1>{text.title}</h1>
          <p className="muted">{text.description}</p>
        </div>
      </section>

      <section className="curation-stat-grid">
        <CurationStat label={text.workQueue} value={overview.stats.worksNeedingAttention} href="#work-queue" />
        <CurationStat label={text.personQueue} value={overview.stats.peopleNeedingAttention} href="#person-queue" />
        <CurationStat label={text.pendingEvidence} value={pendingEvidence} href="/curation/evidence" />
        <CurationStat label={text.duplicates} value={overview.stats.duplicateWorks + overview.stats.duplicatePeople} href="/curation/duplicates" />
      </section>

      <section className="curation-queue" id="work-queue">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WORK METADATA QUALITY</span>
            <h2>{text.workQueue}</h2>
          </div>
          <Link className="secondary-button" href="/works">{text.open}</Link>
        </div>
        <div className="curation-list">
          {overview.works.filter((item) => item.completeness.missingIds.length > 0).slice(0, 12).map(({ work, completeness }) => (
            <article className="curation-row" key={work.id}>
              <div className="curation-row__identity">
                <span className="work-code">{work.code}</span>
                <strong>{localizeText(work.titles, preferences.metadataLanguage, work.code)}</strong>
              </div>
              <CompletenessBadge score={completeness.score} level={completeness.level} label={text[completeness.level]} />
              <div className="curation-row__missing">
                <span>{text.missing}</span>
                <p>{completeness.missingIds.map((id) => text.workMissing[id as keyof typeof text.workMissing] ?? id).join(" · ") || "—"}</p>
              </div>
              <Link className="secondary-button" href={`/works/${encodeURIComponent(work.id)}`}>{text.open}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="curation-queue" id="person-queue">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PERSON PROFILE QUALITY</span>
            <h2>{text.personQueue}</h2>
          </div>
          <Link className="secondary-button" href="/people">{text.open}</Link>
        </div>
        <div className="curation-list">
          {overview.people.filter((item) => item.completeness.missingIds.length > 0).slice(0, 12).map(({ person, completeness }) => (
            <article className="curation-row" key={person.id}>
              <div className="curation-row__identity">
                <span className="work-code">PERSON</span>
                <strong>{getPreferredPersonName(person, preferences.metadataLanguage)}</strong>
              </div>
              <CompletenessBadge score={completeness.score} level={completeness.level} label={text[completeness.level]} />
              <div className="curation-row__missing">
                <span>{text.missing}</span>
                <p>{completeness.missingIds.map((id) => text.personMissing[id as keyof typeof text.personMissing] ?? id).join(" · ") || "—"}</p>
              </div>
              <div className="curation-row__actions">
                <Link className="secondary-button" href={`/people/${encodeURIComponent(person.id)}`}>{text.open}</Link>
                <Link className="primary-button" href={`/people/${encodeURIComponent(person.id)}/edit`}>{text.editPerson}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="curation-action-grid">
        <Link className="curation-action-card" href="/curation/evidence">
          <span className="eyebrow">EVIDENCE LIFECYCLE</span>
          <strong>{text.pendingEvidence}: {pendingEvidence}</strong>
          <p>{text.ignoredEvidence}: {ignoredEvidence}</p>
        </Link>
        <Link className="curation-action-card" href="/curation/duplicates">
          <span className="eyebrow">DUPLICATE CANDIDATES</span>
          <strong>{text.duplicateWorks}: {overview.stats.duplicateWorks}</strong>
          <p>{text.duplicatePeople}: {overview.stats.duplicatePeople}</p>
        </Link>
      </section>
    </div>
  );
}

function CurationStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link className="curation-stat" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

function CompletenessBadge({ score, level, label }: { score: number; level: string; label: string }) {
  return (
    <div className={`completeness-badge completeness-badge--${level}`}>
      <strong>{score}%</strong>
      <span>{label}</span>
    </div>
  );
}
