import { useEffect, useRef } from "react";

import { useDesktopI18n } from "./desktop-i18n";

/**
 * 瀑布流末端的渐进加载触发器。
 *
 * IntersectionObserver 由浏览器负责判断元素是否接近可视区，比在 scroll 事件里
 * 每一帧读取坐标更省资源。600px 的预取距离让下一批通常能在用户看到页尾前完成；
 * 同时保留按钮，既方便键盘用户，也可在旧 WebView 不支持观察器时手动继续。
 */
export function DesktopInfiniteScrollSentinel({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useDesktopI18n();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore || loading || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) onLoadMore(); },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <div className="desktop-infinite-scroll-sentinel" ref={sentinelRef}>
      {hasMore ? (
        <button disabled={loading} onClick={onLoadMore} type="button">
          {loading ? t("正在加载更多…") : t("加载更多")}
        </button>
      ) : <span>{t("已经到底了")}</span>}
    </div>
  );
}
