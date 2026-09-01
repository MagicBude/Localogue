import Link from "next/link";

import { PreferenceControls } from "@/components/preference-controls";
import type { UiDictionary } from "@/i18n/ui";
import type { UserPreferences } from "@/lib/preferences";

interface SiteHeaderProps {
  preferences: UserPreferences;
  dictionary: UiDictionary;
}

export function SiteHeader({ preferences, dictionary }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand-block">
          <Link className="brand" href="/">
            Localogue
          </Link>
          <span className="brand-subtitle">{dictionary.brandSubtitle}</span>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          <Link href="/">{dictionary.navHome}</Link>
          <Link href="/works">{dictionary.navWorks}</Link>
          <Link href="/people">{dictionary.navPeople}</Link>
          <Link href="/about">{dictionary.navAbout}</Link>
        </nav>

        <PreferenceControls
          uiLanguage={preferences.uiLanguage}
          metadataLanguage={preferences.metadataLanguage}
          theme={preferences.theme}
          dictionary={dictionary}
        />
      </div>
    </header>
  );
}
