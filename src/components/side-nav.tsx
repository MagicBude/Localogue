"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PreferenceControls } from "@/components/preference-controls";
import { ProfileSwitcher } from "@/components/profile-switcher";
import type { UiDictionary } from "@/i18n/ui";
import type { UserPreferences } from "@/lib/preferences";

interface SideNavProps {
  dictionary: UiDictionary;
  preferences: UserPreferences;
}

/**
 * 固定左侧导航栏，替代原来的顶部横排导航。
 *
 * 为什么做成 Client Component：
 * - 需要用 usePathname() 判断“当前停在哪个页面”，给对应链接加高亮；
 * - 窄屏时要用一个开关把侧栏收起 / 展开，这需要组件内部状态。
 * 其余页面仍然保持 Server Component，只有这一层是客户端组件，避免整站都变客户端。
 */
export function SideNav({ dictionary, preferences }: SideNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 判断某个导航项是否“当前激活”：
  // - “首页 /”只有路径完全相等才算；
  // - 其余项只要路径以它开头（例如 /works/123 也算在“作品”下）就算激活。
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const navItems = [
    { href: "/", label: dictionary.navHome },
    { href: "/works", label: dictionary.navWorks },
    { href: "/people", label: dictionary.navPeople },
    { href: "/browse", label: dictionary.navBrowse },
    { href: "/import", label: dictionary.navImport },
    { href: "/review", label: dictionary.navReview },
    { href: "/curation", label: dictionary.navCuration },
    { href: "/media", label: dictionary.navMedia },
    { href: "/packs", label: dictionary.navPacks },
    { href: "/history", label: dictionary.navHistory },
    { href: "/settings", label: dictionary.navSettings },
    { href: "/about", label: dictionary.navAbout },
  ];

  return (
    <>
      {/* 窄屏时出现的汉堡按钮，点击展开 / 收起侧栏 */}
      <button
        aria-label="切换导航"
        className="side-nav__toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* 侧栏展开时的半透明遮罩，点击任意处可关闭 */}
      <div
        className={`nav-backdrop${open ? " is-open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <nav aria-label="Primary navigation" className={`side-nav${open ? " is-open" : ""}`}>
        <div className="side-nav__brand">
          <Link className="side-nav__brand-link" href="/" onClick={() => setOpen(false)}>
            Localogue
          </Link>
          <span className="side-nav__brand-sub">{dictionary.brandSubtitle}</span>
        </div>

        <div className="side-nav__links">
          {navItems.map((item) => (
            <Link
              className={`side-nav__link${isActive(item.href) ? " is-active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="side-nav__footer">
          <PreferenceControls
            dictionary={dictionary}
            metadataLanguage={preferences.metadataLanguage}
            theme={preferences.theme}
            uiLanguage={preferences.uiLanguage}
          />
          <ProfileSwitcher label={dictionary.libraryProfile} />
        </div>
      </nav>
    </>
  );
}
