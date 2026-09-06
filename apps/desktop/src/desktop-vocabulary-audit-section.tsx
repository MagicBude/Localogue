import { findApprovedGenreAlias } from "@/application/services/genre-localization-service";

import { useDesktopI18n } from "./desktop-i18n";
import type { VocabularyRepairPreview, VocabularyRepairResult } from "./vocabulary-repair";

interface VocabularyAuditSectionProps {
  busy: boolean;
  preview: VocabularyRepairPreview | null;
  result: VocabularyRepairResult | null;
  onPreview: () => void;
  onApply: () => void;
}

/**
 * 早期 NFO 分类污染的专用修复面板。
 *
 * Preview 只解释将发生的变化，Apply 回调才真正写入；组件本身不访问 Repository，
 * 因而无法绕过父页面的显式确认、Private Library 限制与写入编排。
 */
export function VocabularyAuditSection({ busy, preview, result, onPreview, onApply }: VocabularyAuditSectionProps) {
  const { t, metadataLanguage } = useDesktopI18n();
  return (
    <section className="settings-card vocabulary-audit-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">VOCABULARY AUDIT</span>
          <h2>{t("分类词表审计")}</h2>
          <p className="muted">{t("检查早期 NFO 导入把“系列: … / 单体作品 / イメージビデオ”等混入 Genre / Tag 的情况。先预览，再显式修复；用户手工 Tag 不会被删除。")}</p>
        </div>
        <div className="button-row">
          <button disabled={busy} onClick={onPreview}>{busy ? t("处理中…") : t("检查分类")}</button>
          <button className="primary-button" disabled={busy || !preview?.affectedWorks} onClick={onApply}>{t("应用修复")}</button>
        </div>
      </div>

      {preview ? <>
        <div className="mini-stat-grid">
          <MiniStat label={t("扫描 Work")} value={preview.scannedWorks} />
          <MiniStat label={t("需要修复")} value={preview.affectedWorks} />
          <MiniStat label={t("移入 Series")} value={preview.movedToSeries} />
          <MiniStat label={t("移入作品类型")} value={preview.movedToWorkTypes} />
          <MiniStat label={t("移入 Genre")} value={preview.movedToGenres} />
          <MiniStat label={t("Unmapped 来源词")} value={preview.unmappedTerms.length} />
        </div>
        {preview.unmappedTerms.length ? <details>
          <summary>{t("查看 unmapped 来源词（不会自动进入 Canonical）")}</summary>
          <div className="token-list vocabulary-unmapped-list">
            {preview.unmappedTerms.slice(0, 200).map((term) => {
              const reference = findApprovedGenreAlias(term);
              const localized = reference
                ? metadataLanguage === "zh-CN" ? reference["zh-CN"] : metadataLanguage === "en" ? reference.en : reference.ja
                : undefined;
              return <code key={term} title={reference ? `${reference.sources.join(" / ")} · ${reference.note ?? "approved genre alias"}` : undefined}>
                {localized && localized !== term ? `${term} → ${localized}` : term}{reference ? ` · ${t("词表参考")}` : ""}
              </code>;
            })}
          </div>
        </details> : null}
        <p className="muted">{t("将移除 {genres} 个早期 NFO Genre 引用和 {tags} 个早期 NFO Tag 引用，再按映射表重新分流。", { genres: preview.removedImportedGenres, tags: preview.removedImportedTags })}</p>
      </> : <p className="muted">{t("尚未执行分类审计。这个工具专门修复早期 Desktop NFO Bootstrap 产生的分类污染。")}</p>}

      {result ? <p className="success-message">{t("上次修复：更新 {works} 个 Work · 新建 Series {series} · 新建 Genre {genres}", { works: result.updatedWorks, series: result.createdSeries, genres: result.createdGenres })}</p> : null}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
