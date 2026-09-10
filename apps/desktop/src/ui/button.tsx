import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "default" | "primary" | "danger" | "ghost";
type ButtonSize = "default" | "compact" | "icon";

/**
 * Desktop 的基础按钮只统一交互状态和视觉语义，不封装业务动作。
 * 页面仍负责决定何时保存或删除，Primitive 只让 loading、图标和焦点表现一致。
 */
export const UiButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}>(({ children, className, disabled, icon, loading = false, size = "default", type = "button", variant = "default", ...props }, ref) => {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className].filter(Boolean).join(" ");

  return <button {...props} aria-busy={loading || undefined} className={classes} disabled={disabled || loading} ref={ref} type={type}>
    {loading ? <span className="ui-spinner" aria-hidden="true" /> : icon}
    {children}
  </button>;
});

UiButton.displayName = "UiButton";
