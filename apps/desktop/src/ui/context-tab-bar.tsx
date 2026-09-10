import type { ComponentType } from "react";

export interface ContextTabItem {
  id: string;
  label: string;
  active: boolean;
  icon?: ComponentType;
  onSelect: () => void;
}

/**
 * 页面内部唯一的二级导航。
 *
 * 组件只表达当前位置与切换意图；实际页面状态仍由 App / URL 决定，避免标签组件
 * 自己维护一份可能与页面路由漂移的选中状态。
 */
export function ContextTabBar({ label, items }: { label: string; items: ContextTabItem[] }) {
  return <nav className="context-tabs" aria-label={label}>{items.map((item) => {
    const Icon = item.icon;
    return <button key={item.id} className={item.active ? "is-active" : ""} onClick={item.onSelect} aria-current={item.active ? "page" : undefined}>
      {Icon ? <Icon /> : null}<span>{item.label}</span>
    </button>;
  })}</nav>;
}
