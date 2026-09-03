import type { Asset } from "@/domain/entities/asset";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";

import { DesktopAssetImage } from "./desktop-asset-image";

export type DesktopWorkViewMode = "grid" | "list" | "table";

export interface DesktopWorkCardViewModel {
  work: Work;
  title: string;
  releaseDate: string;
  performerNames: string[];
  makerName?: string;
  poster?: Asset;
}

export function buildDesktopWorkCards(
  works: Work[],
  people: Person[],
  organizations: Organization[],
  assets: Asset[],
): DesktopWorkCardViewModel[] {
  const peopleById = new Map(people.map((item) => [item.id, item]));
  const organizationsById = new Map(organizations.map((item) => [item.id, item]));
  const assetsById = new Map(assets.map((item) => [item.id, item]));
  const subjectAssets = new Map<string, Asset[]>();
  for (const asset of assets) {
    if (asset.subjectType !== "work" || !asset.subjectId) continue;
    const current = subjectAssets.get(asset.subjectId) ?? [];
    current.push(asset);
    subjectAssets.set(asset.subjectId, current);
  }

  return works.map((work) => {
    const referenced = work.assetIds.map((id) => assetsById.get(id)).filter((item): item is Asset => Boolean(item));
    const candidates = uniqueAssets([...referenced, ...(subjectAssets.get(work.id) ?? [])]);
    const poster = chooseWorkPoster(candidates);
    const performerNames = work.personRelations
      .filter((relation) => relation.role === "performer")
      .sort((a, b) => (a.billingOrder ?? 999) - (b.billingOrder ?? 999))
      .map((relation) => peopleById.get(relation.personId))
      .filter((person): person is Person => Boolean(person))
      .map((person) => getPreferredPersonName(person, "ja"));
    const maker = work.makerId ? organizationsById.get(work.makerId) : undefined;

    return {
      work,
      title: localizeText(work.titles, "ja"),
      releaseDate: work.releaseDate?.value ?? "—",
      performerNames,
      makerName: maker ? localizeText(maker.names, "ja") : undefined,
      poster,
    };
  });
}

export function DesktopWorkViewSwitcher({
  current,
  onChange,
}: {
  current: DesktopWorkViewMode;
  onChange: (view: DesktopWorkViewMode) => void;
}) {
  const views: Array<{ id: DesktopWorkViewMode; label: string }> = [
    { id: "grid", label: "海报墙" },
    { id: "list", label: "列表" },
    { id: "table", label: "表格" },
  ];
  return (
    <div className="desktop-view-switcher" aria-label="作品视图">
      {views.map((view) => (
        <button
          aria-pressed={current === view.id}
          className={current === view.id ? "is-active" : undefined}
          key={view.id}
          onClick={() => onChange(view.id)}
          type="button"
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

export function DesktopWorkResults({
  cards,
  view,
  onOpen,
}: {
  cards: DesktopWorkCardViewModel[];
  view: DesktopWorkViewMode;
  onOpen: (id: string) => void;
}) {
  if (view === "list") {
    return (
      <div className="desktop-work-list">
        {cards.map((card) => (
          <article className="desktop-work-list-row" key={card.work.id}>
            <button className="desktop-work-list-poster" onClick={() => onOpen(card.work.id)} type="button">
              <DesktopAssetImage
                asset={card.poster}
                alt={`${card.work.code} poster`}
                fallback={<PosterPlaceholder code={card.work.code} />}
              />
            </button>
            <button className="desktop-work-list-main" onClick={() => onOpen(card.work.id)} type="button">
              <strong className="work-code">{card.work.code}</strong>
              <h3>{card.title}</h3>
              <p>{card.performerNames.join(" · ") || "—"}</p>
            </button>
            <div className="desktop-work-list-facts">
              <span>{card.releaseDate}</span>
              <span>{card.work.durationMinutes !== undefined ? `${card.work.durationMinutes} 分钟` : "—"}</span>
              <span>{card.makerName ?? "—"}</span>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (view === "table") {
    return (
      <div className="desktop-work-table-wrap">
        <table className="desktop-work-table">
          <thead>
            <tr>
              <th>番号</th>
              <th>标题</th>
              <th>发行日期</th>
              <th>时长</th>
              <th>演员</th>
              <th>Maker</th>
              <th>类型</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.work.id} onDoubleClick={() => onOpen(card.work.id)}>
                <td><button className="table-link" onClick={() => onOpen(card.work.id)} type="button">{card.work.code}</button></td>
                <td><button className="table-link table-title-link" onClick={() => onOpen(card.work.id)} type="button">{card.title}</button></td>
                <td>{card.releaseDate}</td>
                <td>{card.work.durationMinutes !== undefined ? `${card.work.durationMinutes} 分钟` : "—"}</td>
                <td>{card.performerNames.join(" · ") || "—"}</td>
                <td>{card.makerName ?? "—"}</td>
                <td>{card.work.workTypeIds.join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="work-grid desktop-work-grid-library">
      {cards.map((card) => (
        <button className="work-tile desktop-poster-card" key={card.work.id} onClick={() => onOpen(card.work.id)} type="button">
          <span className="desktop-work-poster">
            <DesktopAssetImage
              asset={card.poster}
              alt={`${card.work.code} poster`}
              fallback={<PosterPlaceholder code={card.work.code} />}
            />
          </span>
          <span className="work-tile-body">
            <small>{card.releaseDate}</small>
            <strong>{card.work.code}</strong>
            <span>{card.title}</span>
            <em>{card.performerNames.join(" · ") || card.makerName || "—"}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

export function chooseWorkPoster(assets: Asset[]): Asset | undefined {
  return assets.find((asset) => asset.type === "poster")
    ?? assets.find((asset) => asset.type === "cover");
}

function PosterPlaceholder({ code }: { code: string }) {
  return <span className="desktop-poster-placeholder"><b>{code}</b></span>;
}

function uniqueAssets(assets: Asset[]): Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}
