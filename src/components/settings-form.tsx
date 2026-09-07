"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { InstanceSettings } from "@/domain/entities/instance-settings";
import type { LibraryProfile } from "@/domain/entities/library-profile";
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
  libraryProfiles: LibraryProfile[];
  activeLibraryProfileId?: string;
}

export function SettingsForm({
  language,
  settings,
  effectivePrivatePath,
  pathSource,
  settingsPath,
  sharedPacks,
  libraryProfiles,
  activeLibraryProfileId,
}: SettingsFormProps) {
  const router = useRouter();
  const text = getSettingsDictionary(language);
  const [libraryPath, setLibraryPath] = useState(settings.libraryPath ?? "");
  const [sharedPackText, setSharedPackText] = useState(settings.sharedPackPaths.join("\n"));
  const [libraryRootsText, setLibraryRootsText] = useState((settings.libraryRoots ?? []).join("\n"));
  const [mediaScanText, setMediaScanText] = useState((settings.mediaScanPaths ?? []).join("\n"));
  const [nfoScanText, setNfoScanText] = useState((settings.nfoScanPaths ?? []).join("\n"));
  const [ffprobePath, setFfprobePath] = useState(settings.ffprobePath ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const [newProfileName, setNewProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  async function profileAction(body: Record<string, unknown>) {
    setProfileBusy(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? text.failed);
      router.refresh();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setProfileBusy(false);
    }
  }

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
          libraryRoots: libraryRootsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          mediaScanPaths: mediaScanText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          nfoScanPaths: nfoScanText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          ffprobePath,
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
            <span className="eyebrow">LIBRARIES · PROFILES</span>
            <h2>{text.profilesTitle}</h2>
          </div>
        </div>
        <p className="muted">{text.profilesDescription}</p>

        <ul className="profile-list">
          {libraryProfiles.map((profile) => (
            <li
              key={profile.id}
              className={profile.id === activeLibraryProfileId ? "profile-row profile-row--active" : "profile-row"}
            >
              <div className="profile-row__main">
                <strong>{profile.name}</strong>
                {profile.id === activeLibraryProfileId
                  ? <span className="status-chip status-chip--ok">{text.activeProfile}</span>
                  : null}
                <code>{profile.libraryPath ?? "（未设置路径）"}</code>
              </div>
              <div className="profile-actions">
                {profile.id !== activeLibraryProfileId
                  ? (
                    <button
                      type="button"
                      disabled={profileBusy}
                      onClick={() => profileAction({ action: "switch", id: profile.id })}
                    >
                      {text.switchProfile}
                    </button>
                  )
                  : null}
                <button
                  type="button"
                  disabled={profileBusy}
                  onClick={() => {
                    const next = window.prompt(text.profileNamePlaceholder, profile.name);
                    if (next && next.trim()) {
                      profileAction({ action: "rename", id: profile.id, name: next.trim() });
                    }
                  }}
                >
                  {text.renameProfile}
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={profileBusy}
                  onClick={() => {
                    if (window.confirm(text.confirmDeleteProfile)) {
                      profileAction({ action: "remove", id: profile.id });
                    }
                  }}
                >
                  {text.deleteProfile}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="profile-create">
          <input
            value={newProfileName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setNewProfileName(event.target.value)}
            placeholder={text.profileNamePlaceholder}
          />
          <button
            type="button"
            disabled={profileBusy}
            onClick={() => {
              profileAction({ action: "create", name: newProfileName.trim() || undefined });
              setNewProfileName("");
            }}
          >
            {text.addProfile}
          </button>
        </div>

        <div className="profile-example">
          <button type="button" disabled={profileBusy} onClick={() => profileAction({ action: "seed-demo" })}>
            {profileBusy ? text.exampleLibraryBusy : text.addExampleLibrary}
          </button>
          <small>{text.addExampleLibraryHint}</small>
        </div>
      </section>

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


      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">UNIFIED · SOURCE · DISCOVERY</span><h2>{text.mediaTitle}</h2></div></div>
        <label className="settings-field">
          <span>{text.libraryRoots}</span>
          <textarea rows={5} value={libraryRootsText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setLibraryRootsText(event.target.value)} placeholder="E:\\Library\\石川澪 DMM原档合集\nD:\\Another Library" />
          <small>{text.libraryRootsHelp}</small>
        </label>
        <label className="settings-field">
          <span>{text.mediaPaths}</span>
          <textarea rows={5} value={mediaScanText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMediaScanText(event.target.value)} placeholder="D:\\Media\\Movies\nE:\\Archive" />
          <small>{text.mediaHelp}</small>
        </label>
        <label className="settings-field">
          <span>{text.nfoPaths}</span>
          <textarea rows={4} value={nfoScanText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNfoScanText(event.target.value)} placeholder="D:\\Metadata\\NFO\nE:\\NFO-Archive" />
          <small>{text.nfoHelp}</small>
        </label>
        <label className="settings-field">
          <span>{text.ffprobePath}</span>
          <input value={ffprobePath} onChange={(event: ChangeEvent<HTMLInputElement>) => setFfprobePath(event.target.value)} placeholder="ffprobe" />
          <small>{text.ffprobeHelp}</small>
        </label>
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
