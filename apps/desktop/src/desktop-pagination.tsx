import { ChevronLeft20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";

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
  pageSize,
  pageSizeOptions = [12, 24, 48, 96],
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  compact?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const { t } = useDesktopI18n();
  const [jumpValue, setJumpValue] = useState(String(page));
  useEffect(() => setJumpValue(String(page)), [page]);
  const jump = () => {
    const next = Number(jumpValue);
    if (Number.isInteger(next)) onChange(Math.min(pageCount, Math.max(1, next)));
    else setJumpValue(String(page));
  };
  if (!compact) {
    const visiblePages = pageCount <= 7
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : [...new Set([1, Math.max(1, page - 1), page, Math.min(pageCount, page + 1), pageCount])].sort((a, b) => a - b);
    return (
      <nav className={pageCount <= 1 ? "desktop-pagination is-single-page" : "desktop-pagination"} aria-label={t("分页")}>
        {pageCount > 1 ? <div className="desktop-pagination__controls">
          <button type="button" title={t("上一页")} aria-label={t("上一页")} disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}><ChevronLeft20Regular /></button>
          <div className="desktop-pagination__numbers">
            {visiblePages.map((item, index) => {
              const previous = visiblePages[index - 1];
              return <span key={item}>{previous !== undefined && item - previous > 1 ? <i aria-hidden="true">…</i> : null}<button aria-current={item === page ? "page" : undefined} className={item === page ? "is-active" : undefined} onClick={() => onChange(item)} type="button">{item}</button></span>;
            })}
          </div>
          <button type="button" title={t("下一页")} aria-label={t("下一页")} disabled={page >= pageCount} onClick={() => onChange(Math.min(pageCount, page + 1))}><ChevronRight20Regular /></button>
          <label className="desktop-pagination__jump"><span>{t("跳转")}</span><input inputMode="numeric" min="1" max={pageCount} value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") jump(); }} onBlur={jump} type="number" /><span>{t("页")}</span></label>
          <span className="desktop-pagination__total">{t("共 {count} 页", { count: pageCount })}</span>
        </div> : null}
        {onPageSizeChange && pageSize ? <label className="desktop-pagination__size"><span>{t("每页显示")}</span><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>{pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : null}
      </nav>
    );
  }
  return (
    <nav className="desktop-pagination is-compact" aria-label={t("分页")}>
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
