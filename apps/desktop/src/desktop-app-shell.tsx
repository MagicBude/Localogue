import type { DesktopBootstrapSettings, DesktopRuntimeInfo, DesktopSharedPackInfo } from "./contracts";
import { DesktopLanguageControls, useDesktopI18n } from "./desktop-i18n";
import { activeLibraryProfile } from "./library-profiles";
import localogueIcon from "./assets/localogue-icon.png";

export type DesktopPage = "home" | "works" | "people" | "browse" | "review" | "curation" | "history" | "media" | "packs" | "settings" | "favorites";

const NAV_ITEMS: Array<{ id: DesktopPage; label: string; eyebrow: string; short: string }> = [
  { id: "home", label: "首页", eyebrow: "HOME", short: "HM" },
  { id: "works", label: "作品", eyebrow: "WORKS", short: "WK" },
  { id: "people", label: "人物", eyebrow: "PEOPLE", short: "PP" },
  { id: "browse", label: "浏览", eyebrow: "BROWSE", short: "BR" },
  { id: "favorites", label: "收藏", eyebrow: "FAVORITES", short: "FA" },
  { id: "review", label: "审核", eyebrow: "REVIEW", short: "RV" },
  { id: "curation", label: "治理", eyebrow: "CURATION", short: "CU" },
  { id: "history", label: "历史", eyebrow: "HISTORY", short: "HI" },
  { id: "media", label: "媒体", eyebrow: "MEDIA", short: "MD" },
  { id: "packs", label: "资料包", eyebrow: "PACKS", short: "PK" },
  { id: "settings", label: "设置", eyebrow: "SETTINGS", short: "ST" },
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
    <nav className="nav-list" aria-label="Desktop navigation">{NAV_ITEMS.map((item) => <button className={page === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => onNavigate(item.id)}><span className="nav-item-short" aria-hidden="true">{item.short}</span><span className="nav-item-label">{t(item.label)}</span><small>{item.eyebrow}</small></button>)}</nav>
    <div className="sidebar-spacer" />
    <div className="source-summary"><span className="eyebrow">{t("当前资料库")}</span>{settings.libraryProfiles?.length ? <><strong className="source-profile-name">{selectedProfile?.name ?? t("未绑定配置")}</strong><select className="source-profile-select" aria-label={t("快速切换资料库")} disabled={busy || !profileSwitchEnabled} value={settings.activeLibraryProfileId ?? ""} onChange={(event) => onSwitchProfile(event.target.value)}><option value="" disabled>{t("选择资料库…")}</option>{settings.libraryProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></> : <strong className="source-profile-name">{t("尚未创建资料库")}</strong>}<small>{settings.libraryPath ? t("Private + {count} Shared", { count: validSharedCount }) : t("{count} Shared", { count: validSharedCount })}</small><button className="source-profile-manage" type="button" onClick={() => onNavigate("settings")}>{t(settings.libraryProfiles?.length ? "管理资料库" : "+ 新建资料库")}</button></div>
    <button className="sidebar-collapse-button" title={collapsed ? t("展开侧边栏") : t("收起侧边栏")} aria-label={collapsed ? t("展开侧边栏") : t("收起侧边栏")} onClick={onToggleCollapsed} type="button"><span aria-hidden="true">{collapsed ? "→" : "←"}</span><span className="sidebar-collapse-label">{collapsed ? t("展开侧边栏") : t("收起侧边栏")}</span></button>
    <div className="runtime-pill"><span className={runtime ? "runtime-dot online" : "runtime-dot"} /><span>{runtime ? `${runtime.environment} · ${runtime.version}` : "connecting"}</span></div>
  </aside>;
}

/** 顶栏只提供全局展示操作；刷新和导航仍由 App 决定。 */
export function DesktopTopbar({ page, version, onRefresh, onOpenSettings }: { page: DesktopPage; version?: string; onRefresh: () => void; onOpenSettings: () => void }) {
  const { t } = useDesktopI18n();
  return <header className="topbar"><div><span className="eyebrow">{`LOCAL FIRST · DESKTOP · ${version ?? "…"}`}</span><strong>{t(NAV_ITEMS.find((item) => item.id === page)?.label ?? "首页")}</strong></div><div className="topbar-actions"><DesktopLanguageControls /><button className="ghost-button" onClick={onRefresh}>{t("刷新资料")}</button><button className="ghost-button" onClick={onOpenSettings}>{t("实例设置")}</button></div></header>;
}
