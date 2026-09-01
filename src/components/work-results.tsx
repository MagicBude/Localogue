import Image from "next/image";
import Link from "next/link";

import type { WorkCardViewModel } from "@/application/services/work-presentation-service";
import { WorkCard } from "@/components/work-card";
import type { WorkViewMode } from "@/components/work-view-switcher";
import type { UiDictionary } from "@/i18n/ui";

interface WorkResultsProps {
  dictionary: UiDictionary;
  view: WorkViewMode;
  works: WorkCardViewModel[];
  workTypeLabels: Map<string, string>;
}

/**
 * 同一份作品查询结果可以有不同“表现形式”。
 *
 * 注意这里没有重新查询数据：Grid / List / Table 只负责展示。
 * 这就是把“数据获取”和“UI 表现”分离的一个最直观例子。
 */
export function WorkResults({
  dictionary,
  view,
  works,
  workTypeLabels,
}: WorkResultsProps) {
  if (view === "list") {
    return (
      <div className="work-list">
        {works.map((work) => (
          <article className="work-list-row" key={work.id}>
            <Link className="work-list-row__poster" href={`/works/${work.id}`}>
              {work.posterPath ? (
                <Image alt="" fill sizes="96px" src={work.posterPath} unoptimized />
              ) : (
                <div className="poster-placeholder">{work.code}</div>
              )}
            </Link>
            <div className="work-list-row__main">
              <Link className="work-code" href={`/works/${work.id}`}>
                {work.code}
              </Link>
              <h3>
                <Link href={`/works/${work.id}`}>{work.title}</Link>
              </h3>
              <p className="muted">{work.performerNames.join(" · ") || "—"}</p>
            </div>
            <div className="work-list-row__facts">
              <span>{work.releaseDate}</span>
              <span>
                {work.durationMinutes !== undefined
                  ? `${work.durationMinutes} ${dictionary.minutes}`
                  : "—"}
              </span>
              <span>{work.makerName ?? "—"}</span>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (view === "table") {
    return (
      <div className="work-table-wrap">
        <table className="work-table">
          <thead>
            <tr>
              <th>{dictionary.code}</th>
              <th>{dictionary.title}</th>
              <th>{dictionary.releaseDate}</th>
              <th>{dictionary.duration}</th>
              <th>{dictionary.performer}</th>
              <th>{dictionary.maker}</th>
              <th>{dictionary.workTypes}</th>
            </tr>
          </thead>
          <tbody>
            {works.map((work) => (
              <tr key={work.id}>
                <td>
                  <Link className="work-code" href={`/works/${work.id}`}>
                    {work.code}
                  </Link>
                </td>
                <td>
                  <Link href={`/works/${work.id}`}>{work.title}</Link>
                </td>
                <td>{work.releaseDate}</td>
                <td>
                  {work.durationMinutes !== undefined
                    ? `${work.durationMinutes} ${dictionary.minutes}`
                    : "—"}
                </td>
                <td>{work.performerNames.join(" · ") || "—"}</td>
                <td>{work.makerName ?? "—"}</td>
                <td>
                  {work.workTypeIds
                    .map((id) => workTypeLabels.get(id) ?? id)
                    .join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="work-grid work-grid--library">
      {works.map((work) => (
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
  );
}
