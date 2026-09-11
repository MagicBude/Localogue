import * as Dialog from "@radix-ui/react-dialog";
import { Dismiss20Regular } from "@fluentui/react-icons";
import type { ReactNode } from "react";

import { UiButton } from "./button";

/**
 * 统一确认/编辑对话框的结构和键盘语义。
 * 业务页面继续拥有表单状态与提交函数；这里不猜测“确认”意味着保存还是删除。
 */
export function UiActionDialog({ actions, children, closeLabel, description, onOpenChange, open, title, wide = false }: {
  actions?: ReactNode;
  children?: ReactNode;
  closeLabel: string;
  description: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
  wide?: boolean;
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="ui-dialog-overlay" />
      <Dialog.Content className={wide ? "ui-dialog-content ui-action-dialog is-wide" : "ui-dialog-content ui-action-dialog"}>
        <div className="ui-dialog-header">
          <div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div>
          <Dialog.Close asChild><UiButton aria-label={closeLabel} icon={<Dismiss20Regular />} size="icon" variant="ghost" /></Dialog.Close>
        </div>
        {children ? <div className="ui-action-dialog__body">{children}</div> : null}
        {actions ? <div className="ui-action-dialog__actions">{actions}</div> : null}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
