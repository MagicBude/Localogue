import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { WorkCard } from "@/components/work-card";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { listFavoriteWorkIds } from "@/infrastructure/presentation/presentation-preference-store";
import { getUserPreferences } from "@/lib/preferences";
import { presentWorkCard } from "@/application/services/work-presentation-service";

export const metadata: Metadata = { title: "收藏" };

/**
 * 收藏页：服务器组件。
 *
 * 直接读取私人层里 favorite === true 的作品 ID，再逐个取出 Work 并生成卡片视图。
 * 收藏状态本身来自 PresentationPreference（私人层），与 Canonical Library 解耦，
 * 因此这里只是“按私人偏好列出作品”，不会修改任何公共数据。
 */
export default async function FavoritesPage() {
  const [preferences, favoriteIds] = await Promise.all([
    getUserPreferences(),
    listFavoriteWorkIds(),
  ]);
  const dictionary = getUiDictionary(preferences.uiLanguage);

  const cards = (
    await Promise.all(
      favoriteIds.map(async (id) => {
        const work = await libraryRepository.findWorkById(id);
        return work ? presentWorkCard(libraryRepository, work, preferences.metadataLanguage) : null;
      }),
    )
  ).filter((item) => item !== null);

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">MY LIBRARY · FAVORITES</span>
          <h1>{dictionary.navFavorites}</h1>
          <p className="muted">
            {cards.length} {dictionary.resultCount}
          </p>
        </div>
      </section>

      {cards.length ? (
        <div className="work-grid work-grid--library">
          {cards.map((work) => (
            <WorkCard dictionary={dictionary} key={work.id} work={work} />
          ))}
        </div>
      ) : (
        <EmptyState
          message={dictionary.favoritesEmpty}
          hint={dictionary.favoritesHint}
        />
      )}
    </div>
  );
}
