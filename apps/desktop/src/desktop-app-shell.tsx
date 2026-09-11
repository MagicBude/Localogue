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
  BoxMultiple20Regular,
  Clock20Regular,
  Database20Regular,
  Heart20Regular,
  People20Regular,
  SearchSquare20Regular,
  Search20Regular,
  Wrench20Regular,
  Settings20Regular,
  Toolbox20Regular,
} from "@fluentui/react-icons";
import { useState, type ComponentType, type FormEvent } from "react";
import type { DesktopBootstrapSettings, DesktopRuntimeInfo, DesktopSharedPackInfo } from "./contracts";
import { DesktopLanguageControls, useDesktopI18n } from "./desktop-i18n";
import { activeLibraryProfile } from "./library-profiles";
import localogueIcon from "./assets/localogue-icon.png";
import { UiTooltip } from "./ui/tooltip";
import { ContextTabBar, type ContextTabItem } from "./ui/context-tab-bar";

export type DesktopPage = "home" | "works" | "people" | "browse" | "review" | "curation" | "history" | "media" | "packs" | "settings" | "favorites" | "about";
export type DesktopSettingsModule = "library" | "sources" | "tools" | "about";

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
 * 现有 DesktopPage 和页面组件保持不变，因此本轮只调整信息架构，不触碰查询与写入链。
 */
const NAV_GROUPS: DesktopNavGroup[] = [
  { id: "home", label: "首页", icon: Home20Regular, landingPage: "home", pages: ["home"] },
  {
    id: "library",
    label: "资料库",
    icon: BookDatabase20Regular,
    landingPage: "works",
    pages: ["works", "people", "browse", "favorites"],
  },
  {
    id: "organize",
    label: "导入与整理",
    icon: ArrowSync20Regular,
    landingPage: "media",
    pages: ["media", "review"],
  },
  {
    id: "maintenance",
    label: "资料维护",
    icon: Toolbox20Regular,
    landingPage: "curation",
    pages: ["curation", "history"],
  },
  {
    id: "settings",
    label: "设置",
    icon: Settings20Regular,
    landingPage: "settings",
    pages: ["settings", "packs"],
  },
  { id: "about", label: "关于", icon: Info20Regular, landingPage: "about", pages: ["about"] },
];

/**
 * 应用侧栏属于 Presentation Shell：它只展示当前状态并把用户意图通过回调交还 App。
 * Profile 切换和设置持久化仍由 App 执行，避免导航组件知道 Native Bridge。
 */
export function DesktopSidebar({ page, collapsed, runtime, settings, packInfos, busy, profileSwitchEnabled, onNavigate, onSwitchProfile, onToggleCollapsed }: {
  page: DesktopPage;
  collapsed: boolean;
  runtime: DesktopRuntimeInfo | null;
  settings: DesktopBootstrapSettings;
  packInfos: DesktopSharedPackInfo[];
  busy: boolean;
  profileSwitchEnabled: boolean;
  onNavigate: (page: DesktopPage) => void;
  onSwitchProfile: (profileId: string) => void;
  onToggleCollapsed: () => void;
}) {
  const { t } = useDesktopI18n();
  const selectedProfile = activeLibraryProfile(settings);
  const validSharedCount = packInfos.filter((item) => item.valid).length;

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
    <div className="source-summary">{settings.libraryProfiles?.length ? <select className="source-profile-select" aria-label={t("快速切换资料库")} disabled={busy || !profileSwitchEnabled} value={settings.activeLibraryProfileId ?? ""} onChange={(event) => onSwitchProfile(event.target.value)}><option value="" disabled>{t("选择资料库…")}</option>{settings.libraryProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select> : <button className="source-profile-manage" type="button" onClick={() => onNavigate("settings")}>{t("+ 新建资料库")}</button>}<small>{settings.libraryPath ? t("Private + {count} Shared", { count: validSharedCount }) : t("{count} Shared", { count: validSharedCount })}</small></div>
    <button className="sidebar-collapse-button" title={collapsed ? t("展开侧边栏") : t("收起侧边栏")} aria-label={collapsed ? t("展开侧边栏") : t("收起侧边栏")} onClick={onToggleCollapsed} type="button">{collapsed ? <ChevronRight20Regular /> : <ChevronLeft20Regular />}<span className="sidebar-collapse-label">{collapsed ? t("展开侧边栏") : t("收起侧边栏")}</span></button>
    <div className="runtime-pill"><span className={runtime ? "runtime-dot online" : "runtime-dot"} /><span>{runtime ? `${runtime.environment} · ${runtime.version}` : "connecting"}</span></div>
  </aside>;
}

/** 顶部应用框架只保留跨页面能力；页面设置和数据刷新由各自唯一入口负责。 */
export function DesktopTopbar({ page, version, settingsModule, onSearch, onNavigate, onSettingsModule }: { page: DesktopPage; version?: string; settingsModule: DesktopSettingsModule; onSearch: (text: string) => void; onNavigate: (page: DesktopPage) => void; onSettingsModule: (module: DesktopSettingsModule) => void }) {
  const { t } = useDesktopI18n();
  const [searchText, setSearchText] = useState("");
  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = searchText.trim();
    if (text) onSearch(text);
  }
  const tabs: ContextTabItem[] = page === "works" || page === "people" || page === "browse" || page === "favorites"
    ? [
      { id: "works", label: t("作品"), icon: AppsListDetail20Regular, active: page === "works", onSelect: () => onNavigate("works") },
      { id: "people", label: t("人物"), icon: People20Regular, active: page === "people", onSelect: () => onNavigate("people") },
      { id: "browse", label: t("分类浏览"), icon: SearchSquare20Regular, active: page === "browse", onSelect: () => onNavigate("browse") },
      { id: "favorites", label: t("我的收藏"), icon: Heart20Regular, active: page === "favorites", onSelect: () => onNavigate("favorites") },
    ]
    : page === "curation" || page === "history"
      ? [
        { id: "curation", label: t("资料问题"), icon: Wrench20Regular, active: page === "curation", onSelect: () => onNavigate("curation") },
        { id: "history", label: t("变更历史"), icon: Clock20Regular, active: page === "history", onSelect: () => onNavigate("history") },
      ]
      : page === "settings" || page === "packs"
        ? [
          { id: "library", label: t("资料库与目录"), icon: Database20Regular, active: page === "settings" && settingsModule === "library", onSelect: () => onSettingsModule("library") },
          { id: "sources", label: t("共享资料"), icon: BookContacts20Regular, active: page === "settings" && settingsModule === "sources", onSelect: () => onSettingsModule("sources") },
          { id: "tools", label: t("扫描与工具"), icon: Wrench20Regular, active: page === "settings" && settingsModule === "tools", onSelect: () => onSettingsModule("tools") },
          { id: "about", label: t("诊断"), icon: BoxMultiple20Regular, active: page === "settings" && settingsModule === "about", onSelect: () => onSettingsModule("about") },
          { id: "packs", label: t("导入、导出与备份"), icon: ArrowImport20Regular, active: page === "packs", onSelect: () => onNavigate("packs") },
        ]
        : [];
  return <header className="topbar"><div className="topbar-main"><span className="topbar-product">{`Localogue · ${version ?? "…"}`}</span><form className="topbar-search" role="search" onSubmit={submitSearch}><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={t("搜索番号或标题")} aria-label={t("搜索番号或标题")} /><button type="submit" title={t("搜索")} aria-label={t("搜索")}><Search20Regular aria-hidden="true" /></button></form><DesktopLanguageControls compact /></div>{tabs.length ? <ContextTabBar label={t("页面分类")} items={tabs} /> : null}</header>;
}
