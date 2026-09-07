import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { UrlQueryForm } from "@/components/url-query-form";
import { WorkCard } from "@/components/work-card";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import {
  listFavoriteWorkIds,
  listWorkRatings,
} from "@/infrastructure/presentation/presentation-preference-store";
import { getUserPreferences } from "@/lib/preferences";
import { first, type RawSearchParams } from "@/lib/search-params";
import { presentWorkCard } from "@/application/services/work-presentation-service";
import type { WorkCardViewModel } from "@/application/services/work-presentation-service";

export const metadata: Metadata = { title: "收藏" };

type FavoritesSort = "rating_desc" | "rating_asc" | "release_desc" | "release_asc";

const ALLOWED_SORTS: FavoritesSort[] = [
  "rating_desc",
  "rating_asc",
  "release_desc",
  "release_asc",
];

/**
 * 收藏页：服务器组件。
 *
 * 直接读取私人层里 favorite === true 的作品 ID，再逐个取出 Work 并生成卡片视图。
 * 收藏状态本身来自 PresentationPreference（私人层），与 Canonical Library 解耦，
 * 因此这里只是“按私人偏好列出作品”，不会修改任何公共数据。
 *
 * 排序只发生在内存里的卡片数组上（收藏列表规模很小），不进入 Canonical 查询；
 * 排序结果通过 URL 的 `sort` 参数深链，刷新 / 复制链接均可还原。
 */
export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const [rawParams, preferences, favoriteIds, ratings] = await Promise.all([
    searchParams,
    getUserPreferences(),
    listFavoriteWorkIds(),
    listWorkRatings(),
  ]);
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const sort = parseFavoritesSort(first(rawParams.sort));

  const cards = (
    await Promise.all(
      favoriteIds.map(async (id) => {
        const work = await libraryRepository.findWorkById(id);
        return work
          ? presentWorkCard(libraryRepository, work, preferences.metadataLanguage)
          : null;
      }),
    )
  ).filter((item): item is WorkCardViewModel => item !== null);

  const sorted = sortFavorites(cards, sort, ratings);

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

      {sorted.length ? (
        <>
          <div className="filter-topbar">
            <UrlQueryForm action="/favorites" className="sort-form">
              <label className="field inline-field">
                <span>{dictionary.sort}</span>
                <select defaultValue={sort ?? ""} name="sort">
                  <option value="">{dictionary.favoritesOrder}</option>
                  <option value="rating_desc">{dictionary.rating} ↓</option>
                  <option value="rating_asc">{dictionary.rating} ↑</option>
                  <option value="release_desc">{dictionary.releaseDate} ↓</option>
                  <option value="release_asc">{dictionary.releaseDate} ↑</option>
                </select>
              </label>
            </UrlQueryForm>
          </div>

          <div className="work-grid work-grid--library">
            {sorted.map((work) => (
              <WorkCard dictionary={dictionary} key={work.id} work={work} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState message={dictionary.favoritesEmpty} hint={dictionary.favoritesHint} />
      )}
    </div>
  );
}

function parseFavoritesSort(value: string | undefined): FavoritesSort | undefined {
  return ALLOWED_SORTS.includes(value as FavoritesSort)
    ? (value as FavoritesSort)
    : undefined;
}

function sortFavorites(
  cards: WorkCardViewModel[],
  sort: FavoritesSort | undefined,
  ratings: ReadonlyMap<string, number>,
): WorkCardViewModel[] {
  if (!sort) return cards;
  const ratingOf = (card: WorkCardViewModel) => ratings.get(card.id) ?? 0;
  const sorted = [...cards];
  switch (sort) {
    case "rating_desc":
      return sorted.sort((a, b) => ratingOf(b) - ratingOf(a));
    case "rating_asc":
      return sorted.sort((a, b) => ratingOf(a) - ratingOf(b));
    case "release_desc":
      return sorted.sort((a, b) =>
        (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
      );
    case "release_asc":
      return sorted.sort((a, b) =>
        (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
      );
  }
}
