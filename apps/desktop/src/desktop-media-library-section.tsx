import type { ReactNode } from "react";

import { localizeText } from "@/application/services/localization-service";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Work } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";

interface MediaLibrarySectionProps {
  loading: boolean;
  error: unknown;
  media?: MediaFile[];
  works?: Map<string, Work>;
  assetCount?: number;
  bindingMediaId: string | null;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onToggleBinding: (id: string) => void;
}

/**
 * 展示已进入 Private Library 的 MediaFile。
 *
 * Work / MediaFile 在 Domain 中保持分离：表格只通过 workId 查找展示信息，
 * 打开、定位和人工绑定都交回父页面，因此本组件不会自行修改关联关系。
 */
export function MediaLibrarySection(props: MediaLibrarySectionProps) {
  const { t, metadataLanguage } = useDesktopI18n();
  const { loading, error, media, works } = props;

  if (loading) return <section className="empty-state"><div className="loading-dot" /><strong>{t("正在读取资料库…")}</strong></section>;
  if (error || !media || !works) return <section className="empty-state error-state"><span className="eyebrow">READ ERROR</span><h2>{t("无法读取当前页面")}</h2><p>{toMessage(error)}</p></section>;

  return (
    <section className="settings-card table-card">
      <div className="section-heading">
        <div><span className="eyebrow">PRIVATE LOCAL DATA</span><h2>{media.length} {t("视频")} · {t("{count} 个资产", { count: props.assetCount ?? 0 })}</h2></div>
      </div>
      {media.length ? <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>{t("文件")}</th><th>{t("作品")}</th><th>{t("大小")}</th><th>{t("媒体参数")}</th><th>{t("操作")}</th></tr></thead>
          <tbody>{media.map((file) => {
            const work = file.workId ? works.get(file.workId) : undefined;
            return <tr key={file.id}>
              <td><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></td>
              <td>{work ? <><strong>{work.code}</strong><small>{localizeText(work.titles, metadataLanguage)}</small></> : <span className="status-chip warn">{t("未绑定")}</span>}</td>
              <td>{formatBytes(file.fileSize ?? 0)}</td>
              <td>{mediaSummary(file, t)}</td>
              <td><div className="row-actions">
                <button onClick={() => props.onOpen(file.path)}>{t("打开")}</button>
                <button onClick={() => props.onReveal(file.path)}>{t("定位")}</button>
                <button className={props.bindingMediaId === file.id ? "primary-button" : ""} onClick={() => props.onToggleBinding(file.id)}>{t("管理绑定")}</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p className="muted">{t("尚未扫描到本地媒体。")} </p>}
    </section>
  );
}

function mediaSummary(file: MediaFile, t: (source: string) => string): ReactNode {
  const resolution = file.width && file.height ? `${file.width}×${file.height}` : null;
  const codecs = [file.container, file.videoCodec, file.audioCodec].filter(Boolean).join(" · ");
  return <>
    <strong>{resolution ?? "—"}</strong>
    <small title={file.analysisStale ? t("文件发生变化后旧技术参数会标记为过期，重新扫描成功后自动更新。") : undefined}>
      {codecs || (file.analysisStale ? t("分析已过期") : "—")}
    </small>
  </>;
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "未知错误");
}
