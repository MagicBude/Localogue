import type { Metadata } from "next";
import Link from "next/link";

import { buildCurationOverview } from "@/application/curation/curation-service";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import type { DuplicateCandidate } from "@/domain/entities/duplicate-candidate";
import { getCurationDictionary } from "@/i18n/curation";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "重复候选" };

const reasonLabels = {
  ja: {
    same_code: "同一品番",
    same_title: "同一原題",
    same_release_year: "同一発売年",
    shared_performer: "出演者が重複",
    shared_exact_name: "完全一致する名前・別名",
    same_birth_date: "同一生年月日",
  },
  "zh-CN": {
    same_code: "规范化番号相同",
    same_title: "规范化原题相同",
    same_release_year: "发行年份相同",
    shared_performer: "存在共同演员",
    shared_exact_name: "正式名/别名存在精确重叠",
    same_birth_date: "出生日期相同",
  },
  en: {
    same_code: "Same normalized code",
    same_title: "Same normalized original title",
    same_release_year: "Same release year",
    shared_performer: "Shared performer",
    shared_exact_name: "Exact name/alias overlap",
    same_birth_date: "Same birth date",
  },
} as const;

export default async function DuplicateCandidatesPage() {
  const preferences = await getUserPreferences();
  const text = getCurationDictionary(preferences.uiLanguage);
  const reasons = reasonLabels[preferences.uiLanguage];
  const [overview, allWorks, allPeople, confidenceLabels] = await Promise.all([
    buildCurationOverview(libraryRepository),
    libraryRepository.listWorks({ page: 1, pageSize: 999999 }),
    libraryRepository.listPeople({ page: 1, pageSize: 999999 }),
    getVocabularyLabelMap(vocabularyRepository, "duplicate-confidence-levels", preferences.uiLanguage),
  ]);
  const workMap = new Map(allWorks.items.map((item) => [item.id, item]));
  const personMap = new Map(allPeople.items.map((item) => [item.id, item]));

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · DUPLICATE DISCOVERY</span>
          <h1>{text.duplicates}</h1>
          <p className="muted">{text.warning}</p>
        </div>
        <Link className="secondary-button" href="/curation">← {text.title}</Link>
      </section>

      <DuplicateSection
        title={text.duplicateWorks}
        candidates={overview.duplicateWorks}
        renderPair={(candidate) => {
          const left = workMap.get(candidate.leftId);
          const right = workMap.get(candidate.rightId);
          return {
            left: left ? `${left.code} · ${localizeText(left.titles, preferences.metadataLanguage, left.code)}` : candidate.leftId,
            right: right ? `${right.code} · ${localizeText(right.titles, preferences.metadataLanguage, right.code)}` : candidate.rightId,
            leftHref: `/works/${encodeURIComponent(candidate.leftId)}`,
            rightHref: `/works/${encodeURIComponent(candidate.rightId)}`,
          };
        }}
        confidenceLabels={confidenceLabels}
        reasons={reasons}
        text={text}
      />

      <DuplicateSection
        title={text.duplicatePeople}
        candidates={overview.duplicatePeople}
        renderPair={(candidate) => {
          const left = personMap.get(candidate.leftId);
          const right = personMap.get(candidate.rightId);
          return {
            left: left ? getPreferredPersonName(left, preferences.metadataLanguage) : candidate.leftId,
            right: right ? getPreferredPersonName(right, preferences.metadataLanguage) : candidate.rightId,
            leftHref: `/people/${encodeURIComponent(candidate.leftId)}`,
            rightHref: `/people/${encodeURIComponent(candidate.rightId)}`,
          };
        }}
        confidenceLabels={confidenceLabels}
        reasons={reasons}
        text={text}
      />
    </div>
  );
}

function DuplicateSection({
  title,
  candidates,
  renderPair,
  confidenceLabels,
  reasons,
  text,
}: {
  title: string;
  candidates: DuplicateCandidate[];
  renderPair: (candidate: DuplicateCandidate) => { left: string; right: string; leftHref: string; rightHref: string };
  confidenceLabels: ReadonlyMap<string, string>;
  reasons: Record<string, string>;
  text: ReturnType<typeof getCurationDictionary>;
}) {
  return (
    <section className="detail-section">
      <div className="section-heading"><h2>{title}</h2><span className="muted">{candidates.length}</span></div>
      {candidates.length ? (
        <div className="duplicate-list">
          {candidates.map((candidate) => {
            const pair = renderPair(candidate);
            return (
              <article className="duplicate-card" key={candidate.id}>
                <div className={`duplicate-confidence duplicate-confidence--${candidate.confidence}`}>
                  <small>{text.confidence}</small>
                  <strong>{confidenceLabels.get(candidate.confidence) ?? candidate.confidence}</strong>
                </div>
                <div className="duplicate-pair">
                  <Link href={pair.leftHref}>{pair.left}</Link>
                  <span>↔</span>
                  <Link href={pair.rightHref}>{pair.right}</Link>
                </div>
                <div className="duplicate-reasons">
                  <small>{text.reasons}</small>
                  <p>{candidate.reasonIds.map((reason) => reasons[reason] ?? reason).join(" · ")}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="muted">{text.noItems}</p>}
    </section>
  );
}
