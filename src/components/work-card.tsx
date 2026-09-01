import Image from "next/image";
import Link from "next/link";

import type { WorkCardViewModel } from "@/application/services/work-presentation-service";
import type { UiDictionary } from "@/i18n/ui";

interface WorkCardProps {
  work: WorkCardViewModel;
  dictionary: UiDictionary;
  workTypeLabels?: string[];
}

export function WorkCard({ work, dictionary, workTypeLabels = [] }: WorkCardProps) {
  return (
    <article className="work-card">
      <Link className="work-card__poster" href={`/works/${work.id}`}>
        {work.posterPath ? (
          <Image
            src={work.posterPath}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 45vw, (max-width: 1100px) 28vw, 210px"
          />
        ) : (
          <div className="poster-placeholder" aria-hidden="true">
            {work.code}
          </div>
        )}
      </Link>

      <div className="work-card__body">
        <Link className="work-code" href={`/works/${work.id}`}>
          {work.code}
        </Link>
        <h3>
          <Link href={`/works/${work.id}`}>{work.title}</Link>
        </h3>

        <div className="work-card__meta">
          <span>{work.releaseDate}</span>
          {work.durationMinutes !== undefined ? (
            <span>
              {work.durationMinutes} {dictionary.minutes}
            </span>
          ) : null}
        </div>

        {work.performerNames.length ? (
          <p className="work-card__people">{work.performerNames.join(" · ")}</p>
        ) : null}

        {workTypeLabels.length ? (
          <div className="chip-row">
            {workTypeLabels.map((label) => (
              <span className="chip" key={label}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
