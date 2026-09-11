import type { MediaFile } from "@/domain/entities/media-file";

import { useDesktopI18n } from "./desktop-i18n";

interface DesktopWorkMediaSectionProps {
  media: MediaFile[];
  onPlay: (path: string) => void;
  onReveal: (path: string) => void;
}

/**
 * 作品详情中的本地媒体操作区。
 *
 * 组件只展示已经由 Repository 按 workId 找到的 MediaFile，并把用户意图通过回调上报。
 * 它不直接调用 Tauri，因此“展示哪些文件”和“Native 允许打开什么路径”仍是两层边界。
 * 多文件作品逐项列出，不擅自把第一段当成整部作品，也不会在用户点击前启动播放器。
 */
export function DesktopWorkMediaSection({ media, onPlay, onReveal }: DesktopWorkMediaSectionProps) {
  const { t } = useDesktopI18n();

  return <section className="settings-card desktop-work-media-section">
    <div className="section-heading">
      <div><span className="eyebrow">LOCAL MEDIA</span><h2>{t("本地媒体")}</h2></div>
      <small className="muted">{t("{count} 个文件", { count: media.length })}</small>
    </div>
    {media.length ? <div className="desktop-work-media-list">
      {[...media].sort(compareMediaOrder).map((file) => <article className="desktop-work-media-row" key={file.id}>
        <div>
          <strong>{file.fileName}</strong>
          <span>{mediaSummary(file)}</span>
          {file.recognition?.reasons.length ? <small className="warning-text">{file.recognition.reasons.join("；")}</small> : null}
          <code>{file.path}</code>
        </div>
        <div className="row-actions">
          <button className="primary-button" type="button" onClick={() => onPlay(file.path)}>{t("播放")}</button>
          <button type="button" onClick={() => onReveal(file.path)}>{t("打开所在位置")}</button>
        </div>
      </article>)}
    </div> : <p className="muted">{t("尚未关联本地视频。请在“本地资料”中执行一键同步，或为扫描到的媒体人工绑定作品。")}</p>}
  </section>;
}

function compareMediaOrder(a: MediaFile, b: MediaFile): number {
  const editionA = a.recognition?.editionTags.join("+") ?? "";
  const editionB = b.recognition?.editionTags.join("+") ?? "";
  return editionA.localeCompare(editionB, "en")
    || (a.recognition?.part?.index ?? 0) - (b.recognition?.part?.index ?? 0)
    || a.fileName.localeCompare(b.fileName, "en", { numeric: true });
}

/** 技术摘要只帮助区分多版本文件；真实可播放性仍交给操作系统的默认播放器判断。 */
function mediaSummary(file: MediaFile): string {
  const resolution = file.width && file.height ? `${file.width}×${file.height}` : undefined;
  const part = file.recognition?.part ? `CD${file.recognition.part.index}` : undefined;
  const editions = file.recognition?.editionTags.map((item) => item.toUpperCase()).join(" + ");
  return [part, editions, resolution, file.container, file.videoCodec, file.audioCodec].filter(Boolean).join(" · ") || "—";
}
