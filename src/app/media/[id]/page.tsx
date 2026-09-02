import Link from "next/link";
import { notFound } from "next/navigation";

import { MediaBindingWorkbench } from "@/components/media-binding-workbench";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";

export default async function MediaFileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await libraryRepository.findMediaFileById(id);
  if (!media) notFound();
  const work = media.workId ? await libraryRepository.findWorkById(media.workId) : null;

  return <div className="page-stack">
    <section className="page-title-row"><div><span className="eyebrow">PRIVATE · MEDIAFILE · INCREMENTAL</span><h1>{media.fileName}</h1><p className="path-text">{media.path}</p></div><Link className="secondary-button" href="/media">返回媒体库</Link></section>
    <section className="detail-grid">
      <article className="detail-card"><span>当前绑定</span><strong>{work ? work.code : "未绑定"}</strong>{work ? <Link href={`/works/${work.id}`}>{work.titles.ja ?? work.code}</Link> : <small>等待人工治理</small>}</article>
      <article className="detail-card"><span>Match method</span><strong>{media.matchMethod ?? "—"}</strong><small>{media.matchMethod === "manual" ? "用户明确绑定；自动扫描不会覆盖" : media.matchMethod === "code" ? "扫描器番号精确匹配" : "未匹配"}</small></article>
      <article className="detail-card"><span>Media</span><strong>{media.width && media.height ? `${media.width}×${media.height}` : "—"}</strong><small>{[media.container, media.videoCodec, media.audioCodec].filter(Boolean).join(" · ") || "未分析"}</small>{media.analysisStale ? <small className="status-chip status-chip--warn">技术参数可能已过期</small> : null}</article>
      <article className="detail-card"><span>Incremental fingerprint</span><strong>{formatBytes(media.fileSize ?? 0)}</strong><small>{media.fileModifiedAt ?? "mtime 未记录"}</small></article>
    </section>

    <section className="detail-section">
      <div className="section-heading-row"><div><span className="eyebrow">SIDECAR OBSERVATION</span><h2>NFO / Poster / Fanart</h2></div></div>
      <p className="muted">这些文件只作为本地观察结果。NFO 未来进入 Evidence 流程，图片未来进入 Asset Candidate；扫描本身不会直接改 Canonical Work。</p>
      <div className="detail-grid">
        <SidecarCard title="NFO" values={media.sidecars?.nfoPaths ?? []} />
        <SidecarCard title="Poster" values={media.sidecars?.posterPaths ?? []} />
        <SidecarCard title="Fanart" values={media.sidecars?.fanartPaths ?? []} />
      </div>
    </section>

    <MediaBindingWorkbench currentWorkId={media.workId} mediaFileId={media.id} />
  </div>;
}

function SidecarCard({ title, values }: { title: string; values: string[] }) {
  return <article className="detail-card"><span>{title}</span><strong>{values.length}</strong>{values.length ? <div className="sidecar-path-list">{values.map((value)=><small className="path-text" key={value}>{value}</small>)}</div> : <small>未发现</small>}</article>;
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`;
}
