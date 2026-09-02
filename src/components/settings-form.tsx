"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { InstanceSettings } from "@/domain/entities/instance-settings";
import type { ResolvedSharedPack } from "@/domain/entities/shared-pack";
import { getSettingsDictionary } from "@/i18n/settings";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

interface SettingsFormProps {
  language: SupportedLanguage;
  settings: InstanceSettings;
  effectivePrivatePath: string | null;
  pathSource: "environment" | "settings" | null;
  settingsPath: string;
  sharedPacks: ResolvedSharedPack[];
}

export function SettingsForm({
  language,
  settings,
  effectivePrivatePath,
  pathSource,
  settingsPath,
  sharedPacks,
}: SettingsFormProps) {
  const router = useRouter();
  const text = getSettingsDictionary(language);
  const [libraryPath, setLibraryPath] = useState(settings.libraryPath ?? "");
  const [sharedPackText, setSharedPackText] = useState(settings.sharedPackPaths.join("\n"));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          libraryPath,
          sharedPackPaths: sharedPackText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? text.failed);
      setStatus("saved");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    }
  }

  return (
    <form className="settings-stack" onSubmit={submit}>
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LOCAL · PRIVATE · WRITABLE</span>
            <h2>{text.libraryTitle}</h2>
          </div>
        </div>

        {pathSource === "environment" ? <p className="notice-box">{text.envOverride}</p> : null}

        <label className="settings-field">
          <span>{text.libraryPath}</span>
          <input
            value={libraryPath}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setLibraryPath(event.target.value)}
            placeholder="D:\\LocalogueLibrary  /  ./data/library"
          />
          <small>{text.libraryHelp}</small>
        </label>

        <div className="settings-info-grid">
          <Info label={text.effectivePath} value={effectivePrivatePath ?? "—"} />
          <Info
            label={text.source}
            value={pathSource === "environment" ? text.sourceEnvironment : pathSource === "settings" ? text.sourceSettings : text.sourceNone}
          />
          <Info label={text.settingsFile} value={settingsPath} />
        </div>
      </section>

      <section className="settings-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">COMMUNITY · READ ONLY · SHAREABLE</span>
            <h2>{text.sharedTitle}</h2>
          </div>
        </div>
        <label className="settings-field">
          <span>{text.sharedTitle}</span>
          <textarea
            rows={6}
            value={sharedPackText}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSharedPackText(event.target.value)}
            placeholder="D:\\LocaloguePacks\\community-ja\n../localogue-community-pack"
          />
          <small>{text.sharedHelp}</small>
        </label>

        <div className="shared-pack-list">
          {sharedPacks.length ? sharedPacks.map((pack) => (
            <article className="shared-pack-row" key={pack.configuredPath}>
              <div>
                <strong>{pack.manifest?.name ?? pack.configuredPath}</strong>
                <p>{pack.manifest ? `${pack.manifest.id} · ${pack.manifest.version}` : pack.configuredPath}</p>
              </div>
              <span className={`status-chip ${pack.valid ? "status-chip--ok" : "status-chip--warn"}`}>
                {pack.valid ? text.packValid : text.packInvalid}
              </span>
              <code>{pack.valid ? pack.libraryPath : pack.error}</code>
            </article>
          )) : <p className="muted">{text.noPacks}</p>}
        </div>
      </section>

      <section className="settings-card settings-card--soft">
        <span className="eyebrow">PRECEDENCE</span>
        <h2>{text.precedence}</h2>
        <p><code>{text.localFirst}</code></p>
        <p>{text.sharingBody}</p>
      </section>

      <div className="settings-actions">
        <button className="primary-button" disabled={status === "saving"} type="submit">
          {status === "saving" ? text.saving : text.save}
        </button>
        {status === "saved" ? <span className="success-text">{text.saved}</span> : null}
        {status === "error" ? <span className="error-text">{error || text.failed}</span> : null}
      </div>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="settings-info"><span>{label}</span><code>{value}</code></div>;
}
