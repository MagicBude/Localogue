import type { Metadata } from "next";

import { getSettingsOverview } from "@/application/settings/settings-service";
import { SettingsForm } from "@/components/settings-form";
import { getSettingsDictionary } from "@/i18n/settings";
import { getUserPreferences } from "@/lib/preferences";
import { nodeWebPlatform } from "@/infrastructure/platform/node-platform-provider";

export const metadata: Metadata = { title: "设置" };

export default async function SettingsPage() {
  const preferences = await getUserPreferences();
  const text = getSettingsDictionary(preferences.uiLanguage);
  const overview = getSettingsOverview();

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">INSTANCE · STORAGE · SHARING</span>
          <h1>{text.title}</h1>
          <p className="muted">{text.description}</p>
        </div>
      </section>

      <section className="settings-card settings-card--soft">
        <span className="eyebrow">DISPLAY PREFERENCES</span>
        <h2>{text.browserPrefsTitle}</h2>
        <p>{text.browserPrefsBody}</p>
      </section>

      <section className="settings-card settings-card--soft">
        <span className="eyebrow">PLATFORM ABSTRACTION · V1-12</span>
        <h2>Runtime capabilities</h2>
        <div className="settings-info-grid">
          <div><span>Runtime</span><strong>{nodeWebPlatform.capabilities.runtime}</strong></div>
          <div><span>Background scan</span><strong>{nodeWebPlatform.capabilities.backgroundMediaScan ? "Yes" : "No"}</strong></div>
          <div><span>Cancel scan</span><strong>{nodeWebPlatform.capabilities.cancellableMediaScan ? "Yes" : "No"}</strong></div>
          <div><span>Native folder picker</span><strong>{nodeWebPlatform.capabilities.nativeFolderPicker ? "Yes" : "V1-13 Tauri"}</strong></div>
          <div><span>Open / Reveal file</span><strong>{nodeWebPlatform.capabilities.openPath ? "Yes" : "V1-13 Tauri"}</strong></div>
        </div>
        <p className="muted">V1-12 已把文件系统、ffprobe、Hash、目录选择和文件打开定义成 Platform Ports。Web 继续工作；V1-13 将用 Tauri Adapter 补齐原生能力。</p>
      </section>

      <SettingsForm
        language={preferences.uiLanguage}
        settings={overview.settings}
        effectivePrivatePath={overview.effective.privateLibraryPath}
        pathSource={overview.effective.privateLibraryPathSource}
        settingsPath={overview.settingsPath}
        sharedPacks={overview.effective.sharedPacks}
      />
    </div>
  );
}
