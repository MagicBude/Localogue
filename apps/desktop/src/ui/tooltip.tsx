import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/**
 * Localogue 的统一悬浮提示。
 *
 * Radix 只负责键盘焦点、延迟显示和 Portal 等交互细节，颜色与尺寸仍由
 * 本项目 CSS 决定。这样既获得可靠的无障碍行为，也不会被第三方主题绑住。
 */
export function UiTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="ui-tooltip" side="right" sideOffset={8}>
            {label}
            <TooltipPrimitive.Arrow className="ui-tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
