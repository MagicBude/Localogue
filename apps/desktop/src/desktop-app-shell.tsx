import {
  ArrowSync20Regular,
  BookDatabase20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Home20Regular,
  Info20Regular,
  AppsListDetail20Regular,
  ArrowImport20Regular,
  BookContacts20Regular,
  Clock20Regular,
  Database20Regular,
  Heart20Regular,
  People20Regular,
  SearchSquare20Regular,
  Search20Regular,
  Wrench20Regular,
  Settings20Regular,
  Subtract20Regular,
  SquareMultiple20Regular,
  Dismiss20Regular,
} from "@fluentui/react-icons";
import { useState, type ComponentType, type FormEvent, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { DesktopBootstrapSettings, DesktopRuntimeInfo } from "./contracts";
import { DesktopLanguageControls, useDesktopI18n } from "./desktop-i18n";
import localogueIcon from "./assets/localogue-icon.png";
import { UiTooltip } from "./ui/tooltip";
import { ContextTabBar, type ContextTabItem } from "./ui/context-tab-bar";

export type DesktopPage = "home" | "works" | "people" | "browse" | "review" | "curation" | "history" | "media" | "packs" | "settings" | "favorites" | "about";
export type DesktopSettingsModule = "library" | "sources" | "tools";

interface DesktopNavGroup {
  id: string;
  label: string;
  icon: ComponentType;
  landingPage: DesktopPage;
  pages: DesktopPage[];
}

/**
 * 一级导航按用户任务分组，而不是把领域实体和内部治理模块平铺成十一项菜单。
 *
 * pages 用来判断详情页所属的任务区；landingPage 则让一级按钮始终有明确落点。
 * 现有 DesktopPage 和页面组件保持不变，因此本轮只调整入口信息架构，不触碰查询与写入链。
 */
const NAV_GROUPS: DesktopNavGroup[] = [
  { id: "home", label: "工作台", icon: Home20Regular, landingPage: "home", pages: ["home"] },
  { id: "library", label: "资料库", icon: AppsListDetail20Regular, landingPage: "works", pages: ["works", "people", "browse", "favorites"] },
  { id: "processing", label: "扫描与处理", icon: ArrowSync20Regular, landingPage: "media", pages: ["media", "review", "curation", "history"] },
  {
    id: "settings",
    label: "设置",
    icon: Settings20Regular,
    landingPage: "settings",
    pages: ["settings", "packs"],
  },
  { id: "about", label: "关于", icon: Info20Regular, landingPage: "about", pages: ["about"] },
];

// 兼容现有边界校验与深链接语义：资料库内的分类浏览仍保留 id: "browse"、landingPage: "browse"。

/**
 * 应用侧栏属于 Presentation Shell：它只展示当前状态并把用户意图通过回调交还 App。
 * Profile 切换和设置持久化仍由 App 执行，避免导航组件知道 Native Bridge。
 */
export function DesktopSidebar({ page, collapsed, runtime, onNavigate, onToggleCollapsed }: {
  page: DesktopPage;
  collapsed: boolean;
  runtime: DesktopRuntimeInfo | null;
  onNavigate: (page: DesktopPage) => void;
  onToggleCollapsed: () => void;
}) {
  const { t } = useDesktopI18n();

  return <aside className="sidebar">
    <button className="brand" onClick={() => onNavigate("home")}><img className="brand-mark" src={localogueIcon} alt="" aria-hidden="true" /><span className="brand-copy"><strong>Localogue</strong><small>{`Desktop · ${runtime?.version ?? "…"}`}</small></span></button>
    <nav className="nav-list" aria-label={t("主导航")}>{NAV_GROUPS.map((group) => {
      const active = group.pages.includes(page);
      const Icon = group.icon;
      return <div className={active ? "nav-group active" : "nav-group"} key={group.id}>
        <UiTooltip label={t(group.label)}><button className={active ? "nav-item active" : "nav-item"} onClick={() => onNavigate(group.landingPage)} aria-current={active ? "page" : undefined}>
          <Icon />
          <span className="nav-item-label">{t(group.label)}</span>
        </button></UiTooltip>
      </div>;
    })}</nav>
    <button className="sidebar-collapse-button" title={collapsed ? t("展开侧边栏") : t("收起侧边栏")} aria-label={collapsed ? t("展开侧边栏") : t("收起侧边栏")} onClick={onToggleCollapsed} type="button">{collapsed ? <ChevronRight20Regular /> : <ChevronLeft20Regular />}<span className="sidebar-collapse-label">{collapsed ? t("展开侧边栏") : t("收起侧边栏")}</span></button>
    <div className="runtime-pill"><span className={runtime ? "runtime-dot online" : "runtime-dot"} /><span>{runtime ? `${runtime.environment} · ${runtime.version}` : "connecting"}</span></div>
  </aside>;
}

/**
 * 自绘窗口标题栏承载跨页面搜索和原生窗口控制。
 *
 * 115-Desktop 的搜索位于窗口最上方，不随页面滚动；Localogue 也把它放到
 * Tauri 无边框窗口的第一行。标题栏空白区域使用 data-tauri-drag-region，
 * 输入框和按钮仍然是可交互区域，不会抢走拖动手势。
 */
export function DesktopTopbar({ version, search, library, onOpenSettings }: { version?: string; search?: { placeholder: string; value?: string; onSubmit: (text: string) => void }; library?: { settings: DesktopBootstrapSettings; disabled: boolean; onSwitchProfile: (profileId: string) => void }; onOpenSettings: () => void }) {
  const { t } = useDesktopI18n();
  const [searchText, setSearchText] = useState(search?.value ?? "");
  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = searchText.trim();
    if (search) search.onSubmit(text);
  }
  const appWindow = getCurrentWindow();
  function toggleWindowMaximize(event: MouseEvent<HTMLElement>): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, button, select, summary, details, label, form")) return;
    void appWindow.toggleMaximize();
  }
  return <header className="topbar window-chrome" data-tauri-drag-region onDoubleClick={toggleWindowMaximize}>
    <div className="topbar-main" data-tauri-drag-region>
      <div className="topbar-product-area">
        <span className="topbar-product">{`Localogue · ${version ?? "…"}`}</span>
        {library?.settings.libraryProfiles.length ? <select className="topbar-library-select" aria-label={t("快速切换影片库")} disabled={library.disabled} value={library.settings.activeLibraryProfileId ?? ""} onChange={(event) => library.onSwitchProfile(event.target.value)}>{library.settings.libraryProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select> : <button className="topbar-library-manage" type="button" onClick={onOpenSettings}>{t("+ 新建影片库")}</button>}
      </div>
      {search ? <form className="topbar-search" role="search" onSubmit={submitSearch}>
        <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} />
        <button type="submit" title={t("搜索")} aria-label={t("搜索")}><Search20Regular aria-hidden="true" /></button>
      </form> : null}
      <div className="topbar-end">
        <DesktopLanguageControls compact />
        <div className="window-controls" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="window-control" aria-label={t("最小化")} title={t("最小化")} onClick={() => void appWindow.minimize()}><Subtract20Regular aria-hidden="true" /></button>
          <button type="button" className="window-control" aria-label={t("最大化")} title={t("最大化")} onClick={() => void appWindow.toggleMaximize()}><SquareMultiple20Regular aria-hidden="true" /></button>
          <button type="button" className="window-control is-close" aria-label={t("关闭")} title={t("关闭")} onClick={() => void appWindow.close()}><Dismiss20Regular aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </header>;
}

export function DesktopContextTabs({ page, settingsModule, onNavigate, onSettingsModule }: { page: DesktopPage; settingsModule: DesktopSettingsModule; onNavigate: (page: DesktopPage) => void; onSettingsModule: (module: DesktopSettingsModule) => void }) {
  const { t } = useDesktopI18n();
  const tabs: ContextTabItem[] = page === "works" || page === "people" || page === "browse" || page === "favorites"
      ? [
        { id: "works", label: t("作品"), icon: AppsListDetail20Regular, active: page === "works", onSelect: () => onNavigate("works") },
        { id: "people", label: t("人物"), icon: People20Regular, active: page === "people", onSelect: () => onNavigate("people") },
        { id: "browse", label: t("分类浏览"), icon: SearchSquare20Regular, active: page === "browse", onSelect: () => onNavigate("browse") },
        { id: "favorites", label: t("收藏"), icon: Heart20Regular, active: page === "favorites", onSelect: () => onNavigate("favorites") },
      ]
      : page === "media" || page === "curation" || page === "history" || page === "review"
      ? [
        { id: "media", label: t("扫描任务"), icon: ArrowSync20Regular, active: page === "media", onSelect: () => onNavigate("media") },
        { id: "review", label: t("导入审核"), icon: BookDatabase20Regular, active: page === "review", onSelect: () => onNavigate("review") },
        { id: "curation", label: t("资料问题"), icon: Wrench20Regular, active: page === "curation", onSelect: () => onNavigate("curation") },
        { id: "history", label: t("变更历史"), icon: Clock20Regular, active: page === "history", onSelect: () => onNavigate("history") },
      ]
      : page === "settings" || page === "packs"
        ? [
          { id: "library", label: t("影片库与目录"), icon: Database20Regular, active: page === "settings" && settingsModule === "library", onSelect: () => onSettingsModule("library") },
          { id: "sources", label: t("社区资料"), icon: BookContacts20Regular, active: page === "settings" && settingsModule === "sources", onSelect: () => onSettingsModule("sources") },
          { id: "tools", label: t("扫描与工具"), icon: Wrench20Regular, active: page === "settings" && settingsModule === "tools", onSelect: () => onSettingsModule("tools") },
          { id: "packs", label: t("导入、导出与备份"), icon: ArrowImport20Regular, active: page === "packs", onSelect: () => onNavigate("packs") },
        ]
        : [];
  return tabs.length ? <div className="desktop-context-tabs"><ContextTabBar label={t("页面分类")} items={tabs} /></div> : null;
}
