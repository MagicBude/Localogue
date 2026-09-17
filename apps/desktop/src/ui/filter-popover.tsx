import { useEffect, useRef, useState, type ReactNode } from "react";

import { useDesktopI18n } from "../desktop-i18n";

/**
 * 浏览页共用的筛选入口。
 *
 * 筛选浮窗只改变展示条件，不占用结果区高度。关闭浮窗不会清除条件；点击外部或按
 * Escape 只收起界面，符合桌面文件管理器中“工具按钮 + 临时面板”的操作习惯。
 */
export function FilterPopover({ children, count = 0, label, wide = false, align = "left" }: {
  children: ReactNode;
  count?: number;
  label: ReactNode;
  wide?: boolean;
  align?: "left" | "right";
}) {
  const { t } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="desktop-filter-menu-anchor" ref={anchorRef}>
    <button aria-expanded={open} className="desktop-facet-toggle" type="button" onClick={() => setOpen((value) => !value)}>
      <span>{label}</span>
      {count ? <span className="desktop-facet-toggle__badge">{count}</span> : null}
      <span className="desktop-facet-toggle__caret">{open ? "▴" : "▾"}</span>
    </button>
    {open ? <section aria-label={typeof label === "string" ? label : undefined} className={`desktop-filter-menu${wide ? " is-wide" : ""}${align === "right" ? " is-align-right" : ""}`}>
      <header><strong>{label}</strong><button aria-label={t("关闭")} className="ui-icon-button" type="button" onClick={() => setOpen(false)}>×</button></header>
      <div className="desktop-filter-menu__body">{children}</div>
      <footer><button className="primary-button" type="button" onClick={() => setOpen(false)}>{t("完成")}</button></footer>
    </section> : null}
  </div>;
}
