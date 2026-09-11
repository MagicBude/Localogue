import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { useDesktopI18n } from "../desktop-i18n";
import { UiActionDialog } from "./action-dialog";
import { UiButton } from "./button";

interface ConfirmOptions {
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  dangerous?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<Confirm | null>(null);

/**
 * 全应用只渲染一个确认框。业务代码仍以 await confirm(...) 线性表达流程，
 * 但不再调用会阻塞 WebView、样式也无法统一的 window.confirm。
 */
export function UiConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useDesktopI18n();
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setRequest(null);
  }, []);

  useEffect(() => () => resolver.current?.(false), []);

  const confirm = useCallback<Confirm>((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(options);
  }), []);

  return <ConfirmContext.Provider value={confirm}>
    {children}
    <UiActionDialog
      open={request !== null}
      onOpenChange={(open) => { if (!open) settle(false); }}
      title={request?.title ?? t("确认")}
      description={request?.description ?? ""}
      closeLabel={t("关闭")}
      actions={<><UiButton onClick={() => settle(false)}>{t("取消")}</UiButton><UiButton variant={request?.dangerous ? "danger" : "primary"} onClick={() => settle(true)}>{request?.confirmLabel ?? t("确认")}</UiButton></>}
    />
  </ConfirmContext.Provider>;
}

export function useUiConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useUiConfirm must be used inside UiConfirmProvider");
  return confirm;
}
