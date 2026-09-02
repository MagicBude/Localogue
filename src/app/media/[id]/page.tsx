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
    <section className="page-title-row"><div><span className="eyebrow">PRIVATE · MEDIAFILE</span><h1>{media.fileName}</h1><p className="path-text">{media.path}</p></div><Link className="secondary-button" href="/media">返回媒体库</Link></section>
    <section className="detail-grid">
      <article className="detail-card"><span>当前绑定</span><strong>{work ? work.code : "未绑定"}</strong>{work ? <Link href={`/works/${work.id}`}>{work.titles.ja ?? work.code}</Link> : <small>等待人工治理</small>}</article>
      <article className="detail-card"><span>Match method</span><strong>{media.matchMethod ?? "—"}</strong><small>{media.matchMethod === "manual" ? "用户明确绑定" : media.matchMethod === "code" ? "扫描器番号精确匹配" : "未匹配"}</small></article>
      <article className="detail-card"><span>Media</span><strong>{media.width && media.height ? `${media.width}×${media.height}` : "—"}</strong><small>{[media.container, media.videoCodec, media.audioCodec].filter(Boolean).join(" · ") || "未分析"}</small></article>
    </section>
    <MediaBindingWorkbench currentWorkId={media.workId} mediaFileId={media.id} />
  </div>;
}
