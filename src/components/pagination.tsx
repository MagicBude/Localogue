import Link from "next/link";

import type { UiDictionary } from "@/i18n/ui";
import type { RawSearchParams } from "@/lib/search-params";

interface PaginationProps {
  action: string;
  dictionary: UiDictionary;
  page: number;
  pageSize: number;
  searchParams: RawSearchParams;
  total: number;
  anchorId?: string;
}

/**
 * 通用分页组件。
 *
 * 分页状态同样放进 URL，而不是藏在 React state 里。
 * 这样刷新、复制链接、前进/后退都保持一致；V2 换 SQLite 后也无需改页面协议。
 */
export function Pagination({
  action,
  dictionary,
  page,
  pageSize,
  searchParams,
  total,
  anchorId,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const safePage = Math.min(Math.max(page, 1), pageCount);
  const pages = buildPageWindow(safePage, pageCount);

  return (
    <nav className="pagination" aria-label={dictionary.pagination}>
      <Link
        aria-disabled={safePage <= 1}
        className={safePage <= 1 ? "is-disabled" : undefined}
        href={buildPageHref(action, searchParams, safePage - 1, anchorId)}
      >
        ← {dictionary.previousPage}
      </Link>

      <div className="pagination__pages">
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span aria-hidden="true" key={`ellipsis-${index}`}>
              …
            </span>
          ) : (
            <Link
              aria-current={item === safePage ? "page" : undefined}
              className={item === safePage ? "is-active" : undefined}
              href={buildPageHref(action, searchParams, item, anchorId)}
              key={item}
            >
              {item}
            </Link>
          ),
        )}
      </div>

      <Link
        aria-disabled={safePage >= pageCount}
        className={safePage >= pageCount ? "is-disabled" : undefined}
        href={buildPageHref(action, searchParams, safePage + 1, anchorId)}
      >
        {dictionary.nextPage} →
      </Link>
    </nav>
  );
}

function buildPageWindow(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const valid = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (const page of valid) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  }

  return result;
}

function buildPageHref(
  action: string,
  searchParams: RawSearchParams,
  page: number,
  anchorId?: string,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.set(key, value);
    }
  }

  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  const hash = anchorId ? `#${anchorId}` : "";
  return `${query ? `${action}?${query}` : action}${hash}`;
}
