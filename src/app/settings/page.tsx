import type { Metadata } from "next";

import { getSettingsOverview } from "@/application/settings/settings-service";
import { SettingsForm } from "@/components/settings-form";
import { getSettingsDictionary } from "@/i18n/settings";
import { getUserPreferences } from "@/lib/preferences";

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
