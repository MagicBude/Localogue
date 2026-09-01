import type { Metadata } from "next";

import { ImportWorkbench } from "@/components/import-workbench";
import { getUiDictionary } from "@/i18n/ui";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "导入资料" };

export default async function ImportPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">INGESTION · EVIDENCE FIRST</span>
          <h1>{dictionary.importTitle}</h1>
          <p className="muted">{dictionary.importDescription}</p>
        </div>
      </section>

      <section className="learning-panel">
        <h2>{dictionary.importSafetyTitle}</h2>
        <p>{dictionary.importSafetyBody}</p>
      </section>

      <ImportWorkbench dictionary={dictionary} uiLanguage={preferences.uiLanguage} />
    </div>
  );
}
