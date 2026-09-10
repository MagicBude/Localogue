import { BookInformation20Regular, DocumentText20Regular, FolderOpen20Regular, Info20Regular, WindowDevTools20Regular } from "@fluentui/react-icons";

import type { DesktopRuntimeInfo } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import { PageTitle } from "./desktop-page-primitives";
import { SettingsRow } from "./ui/settings-row";
import { LogViewerDialog } from "./ui/log-viewer-dialog";
import { UiButton } from "./ui/button";

/** 关于页只展示真实运行信息和可执行入口，不放尚未实现的更新或反馈按钮。 */
export function DesktopAboutPage({ runtime, setMessage }: { runtime: DesktopRuntimeInfo | null; setMessage: (message: string) => void }) {
  const { t } = useDesktopI18n();

  return <div className="page-stack about-page">
    <PageTitle eyebrow="LOCALOGUE DESKTOP" title={t("关于")} description={t("查看版本、运行环境和本机数据位置。")}/>
    <div className="ui-settings-list">
      <SettingsRow icon={<Info20Regular />} title="Localogue Desktop" description={t("本地优先的 AV 元数据资料库")} action={<strong>{runtime?.version ?? "…"}</strong>} />
      <SettingsRow icon={<WindowDevTools20Regular />} title={t("运行环境")} description={runtime?.identifier ?? "—"} action={<span>{runtime?.environment ?? "—"}</span>} />
      <SettingsRow icon={<DocumentText20Regular />} title={t("程序日志")} description={t("查看扫描、导入和本机运行记录")} action={<LogViewerDialog setMessage={setMessage} trigger={<UiButton variant="primary">{t("查看日志")}</UiButton>} />} />
      <SettingsRow icon={<FolderOpen20Regular />} title={t("设置文件")} description={runtime?.settingsPath ?? t("尚不可用")} />
      <SettingsRow icon={<BookInformation20Regular />} title={t("项目说明")} description={t("Canonical Library、Evidence 与私人展示偏好均保持本地可用。")}/>
    </div>
  </div>;
}
