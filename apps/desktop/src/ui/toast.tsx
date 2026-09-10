import {
  CheckmarkCircle20Filled,
  Dismiss20Regular,
  ErrorCircle20Filled,
  Info20Filled,
  Warning20Filled,
} from "@fluentui/react-icons";

import { UiButton } from "./button";

export type ToastTone = "info" | "success" | "warning" | "error";

/**
 * 全局消息使用脱离文档流的桌面 Toast，避免消息出现/消失时推动整页内容。
 * 自动消失时机仍由 App 控制；Toast 只负责语义、图标和手动关闭。
 */
export function UiToast({ children, closeLabel, onDismiss, tone }: {
  children: string;
  closeLabel: string;
  onDismiss: () => void;
  tone: ToastTone;
}) {
  const Icon = tone === "success"
    ? CheckmarkCircle20Filled
    : tone === "warning"
      ? Warning20Filled
      : tone === "error"
        ? ErrorCircle20Filled
        : Info20Filled;

  return <div className={`ui-toast ui-toast--${tone}`} role={tone === "error" ? "alert" : "status"}>
    <Icon className="ui-toast__status" aria-hidden="true" />
    <span>{children}</span>
    <UiButton aria-label={closeLabel} icon={<Dismiss20Regular />} onClick={onDismiss} size="icon" variant="ghost" />
  </div>;
}
