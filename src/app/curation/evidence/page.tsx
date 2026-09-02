import type { Metadata } from "next";
import Link from "next/link";

import { EvidenceBulkWorkbench } from "@/components/evidence-bulk-workbench";
import { getCurationDictionary } from "@/i18n/curation";
import { listEvidenceLifecycles } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { listEvidenceRecords } from "@/infrastructure/evidence/evidence-store";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "Evidence 批量治理" };

export default async function EvidenceCurationPage() {
  const preferences = await getUserPreferences();
  const text = getCurationDictionary(preferences.uiLanguage);
  const [records, lifecycles] = await Promise.all([
    listEvidenceRecords(),
    listEvidenceLifecycles(),
  ]);
  const lifecycleMap = new Map(lifecycles.map((item) => [item.evidenceId, item.status]));
  const rows = records.flatMap((record) => {
    const status = lifecycleMap.get(record.id) ?? "pending";
    if (status !== "pending" && status !== "ignored") return [];
    return [{
      id: record.id,
      code: record.normalized.code,
      title: record.normalized.title,
      sourceName: record.sourceName,
      status,
    }];
  });

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · EVIDENCE LIFECYCLE</span>
          <h1>Evidence · {text.title}</h1>
          <p className="muted">{text.description}</p>
        </div>
        <Link className="secondary-button" href="/curation">← {text.title}</Link>
      </section>
      <EvidenceBulkWorkbench language={preferences.uiLanguage} rows={rows} />
    </div>
  );
}
