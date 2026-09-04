import { useEffect, useMemo, useState } from "react";

import type { Asset, AssetType } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";

import { DesktopAssetImage } from "./desktop-asset-image";
import { useDesktopI18n } from "./desktop-i18n";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";

const PERSON_ASSET_NATIVE_CONTRACT_REVISION = 3;

export function PersonAssetGovernance({
  person,
  assets,
  resolved,
  repository,
  runtimeContractRevision,
  onLibraryChanged,
  setMessage,
}: {
  person: Person;
  assets: Asset[];
  resolved?: Asset;
  repository: TauriLibraryRepository;
  runtimeContractRevision: number;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t, assetTypeLabel } = useDesktopI18n();
  const ordered = useMemo(() => orderAssets(assets, resolved?.id), [assets, resolved?.id]);
  const [activeId, setActiveId] = useState<string | undefined>(resolved?.id ?? ordered[0]?.id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActiveId((current) => ordered.some((asset) => asset.id === current) ? current : (resolved?.id ?? ordered[0]?.id));
  }, [ordered, resolved?.id]);

  const active = ordered.find((asset) => asset.id === activeId) ?? ordered[0];
  const nativeReady = runtimeContractRevision >= PERSON_ASSET_NATIVE_CONTRACT_REVISION;

  async function importAsset(type: Extract<AssetType, "portrait" | "gallery">): Promise<void> {
    if (!nativeReady) {
      setMessage(t("Desktop Native Runtime 与当前图片管理界面版本不一致。请完全退出并重新启动 Desktop。"));
      return;
    }
    setBusy(true);
    try {
      const path = await desktopBridge.pickImageFile();
      if (!path) return;
      const stored = await desktopBridge.importPrivateAssetFile(path);
      const id = `asset_person_${crypto.randomUUID()}`;
      const asset: Asset = {
        schemaVersion: 1,
        id,
        type,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        sha256: stored.sha256,
        subjectType: "person",
        subjectId: person.id,
        createdAt: new Date().toISOString(),
      };
      await repository.saveAsset(asset);

      const nextPerson: Person = {
        ...person,
        ...(type === "portrait" && !person.portraitAssetId ? { portraitAssetId: id } : {}),
        galleryAssetIds: type === "gallery" ? unique([...person.galleryAssetIds, id]) : person.galleryAssetIds,
        updatedAt: new Date().toISOString(),
      };
      if (nextPerson.portraitAssetId !== person.portraitAssetId || nextPerson.galleryAssetIds !== person.galleryAssetIds) {
        try {
          await repository.savePerson(nextPerson);
        } catch (error) {
          await repository.deletePrivateAsset(id).catch(() => undefined);
          throw error;
        }
      }
      setMessage(type === "portrait"
        ? t("人物头像已导入 Private Library；可在“首选头像”中决定显示哪一张。")
        : t("人物 Gallery 图片已导入 Private Library。"));
      onLibraryChanged();
    } catch (error) {
      setMessage(t("导入人物图片失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function removeAsset(asset: Asset): Promise<void> {
    setBusy(true);
    try {
      if (!await repository.isPrivateEntity("assets", asset.id)) {
        setMessage(t("该 Asset 来自 Shared Pack，不能直接删除；Shared Pack 始终只读。"));
        return;
      }
      if (!window.confirm(t("解除并删除这个人物 Private Asset 元数据？\n\n{path}\n\n若它仍被首选头像引用，需要先恢复默认。", { path: asset.storagePath }))) return;
      const nextPerson: Person = {
        ...person,
        portraitAssetId: person.portraitAssetId === asset.id ? undefined : person.portraitAssetId,
        galleryAssetIds: person.galleryAssetIds.filter((id) => id !== asset.id),
        updatedAt: new Date().toISOString(),
      };
      const personChanged = nextPerson.portraitAssetId !== person.portraitAssetId || nextPerson.galleryAssetIds.length !== person.galleryAssetIds.length;
      if (personChanged) await repository.savePerson(nextPerson);
      try {
        await repository.deletePrivateAsset(asset.id);
      } catch (error) {
        if (personChanged) await repository.savePerson(person).catch(() => undefined);
        throw error;
      }
      setMessage(t("人物 Private Asset 元数据已删除；content-addressed 图片文件保留。"));
      onLibraryChanged();
    } catch (error) {
      setMessage(t("删除人物图片失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card desktop-person-assets">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PORTRAIT · GALLERY · PRIVATE ASSET</span>
          <h2>{t("人物图片")}</h2>
          <p className="muted">{t("头像与 Gallery 都作为 Private Asset 管理；导入不会改写 Shared Pack。")}</p>
        </div>
        <div className="button-row">
          <button disabled={busy || !nativeReady} onClick={() => void importAsset("portrait")} type="button">+ {t("导入头像")}</button>
          <button disabled={busy || !nativeReady} onClick={() => void importAsset("gallery")} type="button">+ {t("导入 Gallery")}</button>
        </div>
      </div>

      {ordered.length ? (
        <>
          <div className="desktop-person-gallery-stage">
            <DesktopAssetImage asset={active} fallback={<span>—</span>} />
            <div className="desktop-person-gallery-stage__meta">
              <strong>{active ? assetTypeLabel(active.type) : "—"}</strong>
              <code>{active?.id ?? "—"}</code>
            </div>
          </div>
          <div className="desktop-person-gallery-rail">
            {ordered.map((asset) => (
              <button className={asset.id === active?.id ? "is-active" : undefined} key={asset.id} onClick={() => setActiveId(asset.id)} type="button">
                <span><DesktopAssetImage asset={asset} fallback={<span>—</span>} /></span>
                <small>{assetTypeLabel(asset.type)}</small>
              </button>
            ))}
          </div>
          <div className="desktop-person-asset-list">
            {ordered.map((asset) => (
              <article key={asset.id}>
                <div>
                  <strong>{assetTypeLabel(asset.type)}</strong>
                  <code>{asset.storagePath}</code>
                </div>
                <button className="danger-button" disabled={busy} onClick={() => void removeAsset(asset)} type="button">{t("解除 / 删除")}</button>
              </article>
            ))}
          </div>
        </>
      ) : <p className="muted">{t("当前人物还没有 Portrait / Gallery Asset。")}</p>}

      {!nativeReady ? <p className="desktop-presentation-warning">{t("图片导入需要新版 Native Runtime；请完全退出并重新启动 Desktop。")}</p> : null}
    </section>
  );
}

function orderAssets(assets: Asset[], resolvedId?: string): Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()].sort((a, b) => {
    if (a.id === resolvedId) return -1;
    if (b.id === resolvedId) return 1;
    const weight = (asset: Asset) => asset.type === "portrait" ? 0 : asset.type === "gallery" ? 1 : 2;
    return weight(a) - weight(b) || a.id.localeCompare(b.id);
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
