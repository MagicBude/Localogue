import { formatImportWarning } from "@/i18n/import-warnings";

import { useDesktopI18n } from "./desktop-i18n";
import type { LocalAssetImportPreview, LocalAssetImportResult } from "./local-asset-import";
import type { NfoImportItemStatus, NfoImportPreview, NfoImportResult } from "./nfo-library-import";

interface MetadataImportSectionProps {
  roots: string[];
  busy: boolean;
  nfoPreview: NfoImportPreview | null;
  assetPreview: LocalAssetImportPreview | null;
  nfoResult: NfoImportResult | null;
  assetResult: LocalAssetImportResult | null;
  onPreview: () => void;
  onSaveEvidence: () => void;
  onImport: () => void;
}

/**
 * NFO 与图片导入的展示入口。
 *
 * 它只接收父页面已经计算好的 Preview / Result 和操作回调。目录遍历、解析、
 * Evidence 保存与 Canonical 写入仍由 desktop-media-page 编排，展示组件不碰 Repository。
 */
export function MetadataImportSection(props: MetadataImportSectionProps) {
  const { t } = useDesktopI18n();
  const { roots, busy, nfoPreview, assetPreview, nfoResult, assetResult } = props;

  return (
    <section className="settings-card table-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">UNIFIED METADATA SOURCE</span>
          <h2>{t("NFO + 本地图片")}</h2>
          <p className="muted">{t("推荐只配置一个大目录。Desktop 会递归发现子目录中的 NFO、poster、fanart、thumb，再按番号或同 stem 汇聚到同一个 Work；原始图片不会移动。")}</p>
        </div>
        <div className="button-row">
          <button disabled={busy} onClick={props.onPreview}>{busy ? t("处理中…") : t("预览 NFO + 图片")}</button>
          <button disabled={busy || !nfoPreview?.importable} onClick={props.onSaveEvidence}>{t("保存为 Evidence")}</button>
          <button className="primary-button" disabled={busy || !(nfoPreview?.importable || assetPreview?.linkable)} onClick={props.onImport}>{t("导入当前预览")}</button>
        </div>
      </div>

      <code className="path-block">{roots.length ? roots.join("\n") : t("尚未配置 Unified Library Root / 兼容扫描路径")}</code>
      {nfoPreview ? <NfoPreview preview={nfoPreview} /> : <p className="muted">{t("多段 NFO（例如 MDVR-195.part1～part6）会聚合成一个 Work 组，不再把其余文件显示成一长串“重复番号”。")}</p>}
      {assetPreview ? <AssetPreview preview={assetPreview} /> : null}
      {nfoResult || assetResult ? <ImportResults nfo={nfoResult} assets={assetResult} /> : null}
    </section>
  );
}

function NfoPreview({ preview }: { preview: NfoImportPreview }) {
  const { t, uiLanguage } = useDesktopI18n();
  return <>
    <SectionTitle eyebrow="NFO GROUPS" title={t("NFO 作品组")} />
    <div className="mini-stat-grid">
      <MiniStat label={t("NFO 文件")} value={preview.discovered} />
      <MiniStat label={t("Work 候选")} value={preview.importable} />
      <MiniStat label={t("新 Work")} value={preview.newWorks} />
      <MiniStat label={t("已有 Work")} value={preview.existingWorks} />
      <MiniStat label={t("跳过文件")} value={preview.skipped + preview.errors} />
    </div>
    <div className="table-wrap nfo-preview-table">
      <table className="data-table">
        <thead><tr><th>{t("作品组 / NFO 来源")}</th><th>{t("番号")}</th><th>{t("标题")}</th><th>{t("状态")}</th></tr></thead>
        <tbody>{preview.groups.slice(0, 100).map((group) => (
          <tr key={group.key}>
            <td>
              <strong>{group.sourceCount > 1 ? t("{count} 个 NFO 来源", { count: group.sourceCount }) : group.representative.fileName}</strong>
              {group.sourceCount > 1
                ? <details><summary>{t("查看文件")}</summary><small className="path-text">{group.sources.map((item) => item.fileName).join("\n")}</small></details>
                : <small className="path-text">{group.representative.path}</small>}
            </td>
            <td>{group.code ?? "—"}</td>
            <td>
              {group.title ?? group.representative.error ?? "—"}
              {group.representative.warnings?.length ? <details>
                <summary>{t("{count} 条解析提示", { count: group.representative.warnings.length })}</summary>
                <small className="path-text">{group.representative.warnings.map((warning) => formatImportWarning(warning, uiLanguage)).join("\n")}</small>
              </details> : null}
            </td>
            <td><span className={nfoStatusClass(group.status)}>{nfoStatusLabel(group.status, t)}{group.sourceCount > 1 ? ` · ${t("{count} 个 NFO 来源", { count: group.sourceCount })}` : ""}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    {preview.groups.length > 100 ? <p className="muted">{t("NFO 预览只显示前 100 个作品组；导入会处理全部 {count} 个可识别 Work 候选。", { count: preview.importable })}</p> : null}
  </>;
}

function AssetPreview({ preview }: { preview: LocalAssetImportPreview }) {
  const { t } = useDesktopI18n();
  return <>
    <SectionTitle eyebrow="LOCAL ASSET CANDIDATES" title={t("本地图片资产")} />
    <div className="mini-stat-grid">
      <MiniStat label={t("图片")} value={preview.discovered} />
      <MiniStat label={t("可关联")} value={preview.linkable} />
      <MiniStat label={t("等待 Work")} value={preview.pendingWork} />
      <MiniStat label={t("跳过")} value={preview.skipped} />
    </div>
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>{t("图片")}</th><th>{t("番号")}</th><th>{t("类型")}</th><th>{t("匹配")}</th><th>{t("状态")}</th></tr></thead>
        <tbody>{preview.items.slice(0, 100).map((item) => <tr key={item.path}>
          <td><strong>{item.fileName}</strong><small className="path-text">{item.path}</small></td>
          <td>{item.code ?? "—"}</td>
          <td>{item.type ?? "—"}</td>
          <td>{item.matchedBy === "nfo-stem" ? t("同 NFO stem") : item.matchedBy === "filename-code" ? t("文件名番号") : "—"}</td>
          <td><span className={assetStatusClass(item.status)}>{assetStatusLabel(item.status, t)}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    {preview.items.length > 100 ? <p className="muted">{t("图片预览只显示前 100 条；实际导入会处理全部 {count} 张可关联图片。", { count: preview.linkable })}</p> : null}
  </>;
}

function ImportResults({ nfo, assets }: { nfo: NfoImportResult | null; assets: LocalAssetImportResult | null }) {
  const { t } = useDesktopI18n();
  return <div className="metadata-import-results">
    {nfo ? <p className="success-message">{t("NFO：导入 {imported} · 新建 Work {works} · 更新 {updated} · 新建 Person {people} · 新建 Organization {organizations}", { imported: nfo.imported, works: nfo.createdWorks, updated: nfo.updatedWorks, people: nfo.createdPeople, organizations: nfo.createdOrganizations })}</p> : null}
    {assets ? <p className="success-message">{t("图片：关联 {imported} · 新建 Asset {created} · 复用 {reused} · 更新 Work {works}", { imported: assets.imported, created: assets.createdAssets, reused: assets.reusedAssets, works: assets.updatedWorks })}</p> : null}
    {nfo?.warnings.length ? <details>
      <summary>{t("{count} 条需要留意的 NFO 导入结果（不是应用日志）", { count: nfo.warnings.length })}</summary>
      <p className="muted">{t("这些是本次导入未自动归类的来源词或可恢复问题；完整运行日志仍在设置页的“打开日志位置”。")}</p>
      <ul>{nfo.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </details> : null}
    {assets?.warnings.length ? <details><summary>{t("{count} 条 Asset 导入警告", { count: assets.warnings.length })}</summary><ul>{assets.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
  </div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>;
}

function nfoStatusLabel(status: NfoImportItemStatus, t: (source: string, variables?: Record<string, string | number>) => string): string {
  switch (status) {
    case "new_work": return t("新 Work");
    case "existing_work": return t("补充已有 Work");
    case "missing_code": return t("缺少番号");
    case "missing_title": return t("缺少标题");
    case "duplicate_code": return t("重复番号");
    case "parse_error": return t("解析失败");
  }
}

function nfoStatusClass(status: NfoImportItemStatus): string {
  return status === "new_work" || status === "existing_work" ? "status-chip ok" : "status-chip warn";
}

function assetStatusLabel(status: LocalAssetImportPreview["items"][number]["status"], t: (source: string) => string): string {
  switch (status) {
    case "ready": return t("可关联");
    case "pending_work": return t("等待本轮 NFO 创建 Work");
    case "missing_code": return t("缺少番号");
    case "work_not_found": return t("找不到 Work");
    case "unknown_asset_type": return t("未识别图片角色");
  }
}

function assetStatusClass(status: LocalAssetImportPreview["items"][number]["status"]): string {
  return status === "ready" || status === "pending_work" ? "status-chip ok" : "status-chip warn";
}
