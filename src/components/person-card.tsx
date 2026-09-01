import Image from "next/image";
import Link from "next/link";

interface PersonCardProps {
  id: string;
  name: string;
  secondaryName?: string;
  status: string;
  portraitPath?: string;
  workCount: number;
  worksLabel: string;
}

export function PersonCard({
  id,
  name,
  secondaryName,
  status,
  portraitPath,
  workCount,
  worksLabel,
}: PersonCardProps) {
  return (
    <article className="person-card">
      <Link className="person-card__portrait" href={`/people/${id}`}>
        {portraitPath ? (
          <Image
            src={portraitPath}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 42vw, 180px"
          />
        ) : (
          <div className="portrait-placeholder" aria-hidden="true">
            {name.slice(0, 1)}
          </div>
        )}
      </Link>
      <div className="person-card__body">
        <span className="status-badge">{status}</span>
        <h3>
          <Link href={`/people/${id}`}>{name}</Link>
        </h3>
        {secondaryName ? <p>{secondaryName}</p> : null}
        <span className="muted">
          {workCount} {worksLabel}
        </span>
      </div>
    </article>
  );
}
