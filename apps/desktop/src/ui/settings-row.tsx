import type { ReactNode } from "react";

/** Fluent 风格单行设置项：固定图标、说明和操作槽位，避免页面重复布局代码。 */
export function SettingsRow({ icon, title, description, action }: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return <div className="ui-settings-row">
    <span className="ui-settings-row__icon" aria-hidden="true">{icon}</span>
    <span className="ui-settings-row__copy"><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
    {action ? <span className="ui-settings-row__action">{action}</span> : null}
  </div>;
}
