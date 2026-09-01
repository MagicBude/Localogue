import Link from "next/link";

import { getLibraryStats } from "@/application/services/library-stats-service";
import { presentPersonCard } from "@/application/services/person-presentation-service";
import { presentWorkCard } from "@/application/services/work-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { PersonCard } from "@/components/person-card";
import { StatCard } from "@/components/stat-card";
import { WorkCard } from "@/components/work-card";
import { getPreferredPersonName } from "@/application/services/localization-service";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

export default async function HomePage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);

  const [stats, recentResult, peopleResult, statusLabels, workTypeLabels] =
    await Promise.all([
      getLibraryStats(libraryRepository),
      libraryRepository.listWorks({
        page: 1,
        pageSize: 4,
        sort: "release_desc",
      }),
      libraryRepository.listPeople({ page: 1, pageSize: 24 }),
      getVocabularyLabelMap(
        vocabularyRepository,
        "person-statuses",
        preferences.uiLanguage,
      ),
      getVocabularyLabelMap(
        vocabularyRepository,
        "work-types",
        preferences.metadataLanguage,
      ),
    ]);

  const recentWorks = await Promise.all(
    recentResult.items.map((work) =>
      presentWorkCard(libraryRepository, work, preferences.metadataLanguage),
    ),
  );

  // 首页只展示真正作为 performer 出现过的人物，不把导演混进“演员”推荐区。
  const allWorks = await libraryRepository.listWorks({ page: 1, pageSize: 9999 });
  const performerIds = new Set(
    allWorks.items.flatMap((work) =>
      work.personRelations
        .filter((relation) => relation.role === "performer")
        .map((relation) => relation.personId),
    ),
  );
  const featuredPeople = await Promise.all(
    peopleResult.items
      .filter((person) => performerIds.has(person.id))
      .slice(0, 4)
      .map((person) =>
        presentPersonCard(
          libraryRepository,
          person,
          preferences.metadataLanguage,
        ),
      ),
  );

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">LOCAL-FIRST · CURATION · EXPLORATION</div>
        <h1>Localogue</h1>
        <p>
          先把媒体资料变成长期可信、可浏览、可筛选的个人资料库；数据获取方式只是输入，
          Canonical Library 才是核心。
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/works">
            {dictionary.navWorks}
          </Link>
          <Link className="secondary-button" href="/people">
            {dictionary.navPeople}
          </Link>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">OVERVIEW</span>
            <h2>{dictionary.libraryOverview}</h2>
          </div>
        </div>
        <div className="stats-grid">
          <StatCard label={dictionary.works} value={stats.works} />
          <StatCard label={dictionary.people} value={stats.people} />
          <StatCard label={dictionary.makers} value={stats.makers} />
          <StatCard label={dictionary.labels} value={stats.labels} />
          <StatCard label={dictionary.series} value={stats.series} />
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECENT</span>
            <h2>{dictionary.recentWorks}</h2>
          </div>
          <Link href="/works">{dictionary.browseAll} →</Link>
        </div>
        <div className="work-grid">
          {recentWorks.map((work) => (
            <WorkCard
              dictionary={dictionary}
              key={work.id}
              work={work}
              workTypeLabels={work.workTypeIds.map(
                (id) => workTypeLabels.get(id) ?? id,
              )}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">PEOPLE</span>
            <h2>{dictionary.navPeople}</h2>
          </div>
          <Link href="/people">{dictionary.browseAll} →</Link>
        </div>
        <div className="person-grid">
          {featuredPeople.map((person) => (
            <PersonCard
              id={person.id}
              key={person.id}
              name={person.name}
              portraitPath={person.portraitPath}
              secondaryName={person.secondaryName}
              status={statusLabels.get(person.status) ?? person.status}
              workCount={person.workCount}
              worksLabel={dictionary.works}
            />
          ))}
        </div>
      </section>

      <section className="learning-panel">
        <span className="eyebrow">V1 FOUNDATION</span>
        <h2>这一版正在验证什么？</h2>
        <p>
          页面读取的不是硬编码数组，而是 当前资料库目录中的 JSON；
          React 页面也不会直接接触文件系统，而是经过 Repository 和 Application Service。
          这就是以后从 JSON 平滑切换到 SQLite 的基础。
        </p>
        <p className="muted">
          示例人物和作品均为虚构数据：例如 {getPreferredPersonName(peopleResult.items[0]!, preferences.metadataLanguage)}。
        </p>
      </section>
    </div>
  );
}
