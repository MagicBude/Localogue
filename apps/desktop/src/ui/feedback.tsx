import type { ReactNode } from "react";

type FeedbackTone = "neutral" | "info" | "success" | "warning" | "error";

/** 页面内短状态反馈；仅错误升级为 alert，普通进度不会反复打断读屏。 */
export function UiFeedback({ children, tone = "neutral" }: { children: ReactNode; tone?: FeedbackTone }) {
  return <div className={`ui-feedback ui-feedback--${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

/** 空状态保持紧凑，并为页面保留一个明确的下一步动作槽位。 */
export function UiEmptyState({ action, busy = false, className, description, eyebrow, title, tone = "neutral" }: {
  action?: ReactNode;
  busy?: boolean;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  tone?: "neutral" | "error";
}) {
  return <div className={["ui-empty-state", `ui-empty-state--${tone}`, className].filter(Boolean).join(" ")} role={tone === "error" ? "alert" : "status"}>
    {busy ? <span className="ui-spinner" aria-hidden="true" /> : null}
    {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
    <strong>{title}</strong>
    {description ? <p>{description}</p> : null}
    {action ? <div className="ui-empty-state__action">{action}</div> : null}
  </div>;
}
