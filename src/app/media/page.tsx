import type { Metadata } from "next";
import Link from "next/link";

import { MediaScanWorkbench } from "@/components/media-scan-workbench";
import { getUiDictionary } from "@/i18n/ui";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { readInstanceSettings } from "@/infrastructure/settings/instance-settings-store";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "媒体文件" };

export default async function MediaPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const [mediaFiles, works] = await Promise.all([
    libraryRepository.listMediaFiles(),
    libraryRepository.listWorks({ page: 1, pageSize: 100000 }),
  ]);
  const workMap = new Map(works.items.map((work) => [work.id, work]));
  const settings = readInstanceSettings();
  const totalBytes = mediaFiles.reduce((sum, file) => sum + (file.fileSize ?? 0), 0);
  const matched = mediaFiles.filter((file) => file.workId).length;

  return <div className="page-stack">
    <section className="page-title-row">
      <div>
        <span className="eyebrow">LOCAL · MEDIAFILE · FFPROBE</span>
        <h1>{dictionary.navMedia}</h1>
        <p className="muted">MediaFile 属于私人本地层；Community Work 不会因为你的硬盘文件而被覆盖。</p>
      </div>
      <Link className="secondary-button" href="/settings">{dictionary.navSettings}</Link>
    </section>

    <section className="stats-grid">
      <article className="stat-card"><span>MediaFile</span><strong>{mediaFiles.length}</strong><small>{formatBytes(totalBytes)}</small></article>
      <article className="stat-card"><span>Matched</span><strong>{matched}</strong><small>Work</small></article>
      <article className="stat-card"><span>Unmatched</span><strong>{mediaFiles.length - matched}</strong><small>待识别</small></article>
      <article className="stat-card"><span>Scan roots</span><strong>{settings.mediaScanPaths?.length ?? 0}</strong><small>folders</small></article>
    </section>

    <MediaScanWorkbench language={preferences.uiLanguage} enabled={isPrivateLibraryConfigured()} />

    <section className="detail-section">
      <div className="section-heading-row"><div><span className="eyebrow">MEDIA FILES</span><h2>{dictionary.localFiles}</h2></div></div>
      {mediaFiles.length ? <div className="media-file-table-wrap"><table className="data-table media-file-table"><thead><tr><th>File</th><th>Work</th><th>Size</th><th>Media</th><th>Sidecars</th><th>Codec</th><th>SHA-256</th></tr></thead><tbody>
        {mediaFiles.map((file) => {
          const work = file.workId ? workMap.get(file.workId) : undefined;
          return <tr key={file.id}>
            <td><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></td>
            <td>{work ? <><Link href={`/works/${work.id}`}>{work.code}</Link><small><Link href={`/media/${file.id}`}>管理绑定</Link></small></> : <Link className="status-chip status-chip--warn" href={`/media/${file.id}`}>治理 / 绑定</Link>}</td>
            <td>{formatBytes(file.fileSize ?? 0)}</td>
            <td>{file.width && file.height ? `${file.width}×${file.height}` : "—"}{file.durationSeconds ? <small>{formatDuration(file.durationSeconds)}</small> : null}{file.analysisStale ? <small className="status-chip status-chip--warn">stale</small> : null}</td>
            <td>{sidecarCount(file.sidecars)}<small>{file.sidecars?.nfoPaths.length ? `NFO ${file.sidecars.nfoPaths.length}` : ""}{file.sidecars?.posterPaths.length ? ` · Poster ${file.sidecars.posterPaths.length}` : ""}{file.sidecars?.fanartPaths.length ? ` · Fanart ${file.sidecars.fanartPaths.length}` : ""}</small></td>
            <td>{[file.container, file.videoCodec, file.audioCodec].filter(Boolean).join(" · ") || "—"}</td>
            <td><code>{file.sha256 ? `${file.sha256.slice(0, 12)}…` : "—"}</code></td>
          </tr>;
        })}
      </tbody></table></div> : <p className="muted">尚未扫描本地媒体文件。先在设置页添加扫描目录。</p>}
    </section>
  </div>;
}

function sidecarCount(sidecars: import("@/domain/entities/media-file").MediaSidecarObservation | undefined): number {
  return (sidecars?.nfoPaths.length ?? 0) + (sidecars?.posterPaths.length ?? 0) + (sidecars?.fanartPaths.length ?? 0);
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`;
}
function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60;
  return [h, m, s].map((item, index) => index === 0 ? String(item) : String(item).padStart(2, "0")).join(":");
}
