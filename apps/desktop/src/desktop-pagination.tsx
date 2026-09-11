import { ChevronLeft20Regular, ChevronRight20Regular } from "@fluentui/react-icons";

import { useDesktopI18n } from "./desktop-i18n";

/**
 * 作品与人物共用同一套分页操作，避免两个浏览器逐渐出现不同的按钮、禁用规则和无障碍文案。
 * compact 用于吸顶筛选栏，默认形态则保留在结果底部，照顾两种常见操作路径。
 */
export function DesktopPagination({
  page,
  pageCount,
  onChange,
  compact = false,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  compact?: boolean;
}) {
  const { t } = useDesktopI18n();
  return (
    <nav className={compact ? "desktop-pagination is-compact" : "desktop-pagination"} aria-label={t("分页")}>
      <button type="button" title={t("上一页")} aria-label={t("上一页")} disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
        <ChevronLeft20Regular />
        {!compact ? <span>{t("上一页")}</span> : null}
      </button>
      <span aria-live="polite">{page} / {pageCount}</span>
      <button type="button" title={t("下一页")} aria-label={t("下一页")} disabled={page >= pageCount} onClick={() => onChange(Math.min(pageCount, page + 1))}>
        {!compact ? <span>{t("下一页")}</span> : null}
        <ChevronRight20Regular />
      </button>
    </nav>
  );
}
