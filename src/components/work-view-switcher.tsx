import Link from "next/link";

import type { UiDictionary } from "@/i18n/ui";
import type { RawSearchParams } from "@/lib/search-params";

export type WorkViewMode = "grid" | "list" | "table";

interface WorkViewSwitcherProps {
  action: string;
  current: WorkViewMode;
  dictionary: UiDictionary;
  searchParams: RawSearchParams;
}

/**
 * 视图切换器只改变 URL 中的 view 参数，其余筛选条件全部保留。
 *
 * 这是一个很小但很重要的设计：
 * - 筛选状态属于 URL，而不是隐藏在组件 state 中；
 * - 因此用户可以复制链接、刷新页面、前进后退，而不会丢失当前条件；
 * - 未来换成 SQLite 后，这一层完全无需修改。
 *
 * scroll={false} 是 V1-03 的体验修复：切换“海报墙 / 列表 / 表格”时，
 * Next.js 不再把页面滚动位置重置到顶部，用户仍停留在当前作品区域。
 */
export function WorkViewSwitcher({
  action,
  current,
  dictionary,
  searchParams,
}: WorkViewSwitcherProps) {
  const views: Array<{ id: WorkViewMode; label: string }> = [
    { id: "grid", label: dictionary.viewGrid },
    { id: "list", label: dictionary.viewList },
    { id: "table", label: dictionary.viewTable },
  ];

  return (
    <div className="view-switcher" aria-label={dictionary.viewMode}>
      {views.map((view) => (
        <Link
          aria-current={current === view.id ? "page" : undefined}
          className={current === view.id ? "is-active" : undefined}
          href={buildViewHref(action, searchParams, view.id)}
          key={view.id}
          scroll={false}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}

export function parseWorkView(value: string | string[] | undefined): WorkViewMode {
  const current = Array.isArray(value) ? value[0] : value;
  return current === "list" || current === "table" ? current : "grid";
}

function buildViewHref(
  action: string,
  searchParams: RawSearchParams,
  view: WorkViewMode,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "view" || value === undefined) continue;

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.set(key, value);
    }
  }

  if (view !== "grid") {
    params.set("view", view);
  }

  const query = params.toString();
  return query ? `${action}?${query}` : action;
}
