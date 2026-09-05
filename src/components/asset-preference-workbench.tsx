"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

import type { AssetType } from "@/domain/entities/asset";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

interface CandidateAsset {
  id: string;
  type: AssetType;
  url: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

interface Props {
  entityType: "person" | "work";
  entityId: string;
  language: SupportedLanguage;
  candidates: CandidateAsset[];
  preferredAssetId?: string;
  activeAssetId?: string;
  writable: boolean;
}

const dictionaries = {
  ja: { title: "画像と表示設定", upload: "画像を追加", choose: "表示画像にする", selected: "選択中", reset: "既定に戻す", uploading: "アップロード中…", noAssets: "利用できる画像はまだありません。", readOnly: "Private Library を設定すると、自分の画像を追加・選択できます。", failed: "操作に失敗しました。", type: "画像タイプ" },
  "zh-CN": { title: "图片与显示偏好", upload: "上传图片", choose: "设为显示首图", selected: "当前选择", reset: "恢复资料默认", uploading: "正在上传…", noAssets: "当前还没有可用图片。", readOnly: "配置 Private Library 后，可以上传并选择自己的图片。", failed: "操作失败。", type: "图片类型" },
  en: { title: "Images and display preference", upload: "Upload image", choose: "Use as display image", selected: "Selected", reset: "Use library default", uploading: "Uploading…", noAssets: "No images are available yet.", readOnly: "Configure a Private Library to upload and select your own images.", failed: "Operation failed.", type: "Image type" },
} as const;

export function AssetPreferenceWorkbench(props: Props) {
  const t = dictionaries[props.language];
  const router = useRouter();
  const [type, setType] = useState<AssetType>(props.entityType === "person" ? "portrait" : "poster");
  const [status, setStatus] = useState<"idle"|"busy"|"error">("idle");
  const [error, setError] = useState("");
  const allowedTypes: AssetType[] = props.entityType === "person"
    ? ["portrait", "gallery"]
    : ["poster", "cover", "fanart", "screenshot"];

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("busy"); setError("");
    const form = new FormData(event.currentTarget);
    form.set("subjectType", props.entityType);
    form.set("subjectId", props.entityId);
    form.set("type", type);
    try {
      const response = await fetch("/api/assets/upload", { method: "POST", body: form });
      const body = await response.json() as { error?: string; asset?: { id: string; type: AssetType } };
      if (!response.ok || !body.asset) throw new Error(body.error ?? t.failed);
      if ((props.entityType === "person" && body.asset.type === "portrait") || (props.entityType === "work" && ["poster", "cover", "fanart", "screenshot"].includes(body.asset.type))) {
        await setPreference(body.asset.id);
      }
      event.currentTarget.reset();
      setStatus("idle"); router.refresh();
    } catch (caught) {
      setStatus("error"); setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function choosePreference(assetId: string | null) {
    setStatus("busy"); setError("");
    try {
      await setPreference(assetId);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function setPreference(assetId: string | null) {
    const response = await fetch(`/api/presentation/${props.entityType}/${encodeURIComponent(props.entityId)}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) throw new Error(body.error ?? t.failed);
    router.refresh();
  }

  return <section className="detail-section asset-workbench">
    <div className="section-heading-row"><div><span className="eyebrow">ASSET · LOCAL OVERRIDE</span><h2>{t.title}</h2></div>
      {props.preferredAssetId && props.writable ? <button className="secondary-button" onClick={() => void choosePreference(null)} type="button">{t.reset}</button> : null}
    </div>

    {props.candidates.length ? <div className="asset-choice-grid">
      {props.candidates.map((asset) => {
        const selectable = props.entityType === "person" ? ["portrait", "gallery"].includes(asset.type) : ["poster", "cover", "gallery", "fanart", "screenshot"].includes(asset.type);
        const selected = props.activeAssetId === asset.id;
        return <article className={`asset-choice ${selected ? "asset-choice--selected" : ""}`} key={asset.id}>
          <div className="asset-choice__image"><Image alt="" fill unoptimized sizes="180px" src={asset.url} /></div>
          <div className="asset-choice__meta"><strong>{asset.type}</strong><small>{asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.id}</small></div>
          {selected ? <span className="status-chip status-chip--ok">{t.selected}</span> : selectable && props.writable ? <button className="secondary-button" onClick={() => void choosePreference(asset.id)} type="button">{t.choose}</button> : null}
        </article>;
      })}
    </div> : <p className="muted">{t.noAssets}</p>}

    {props.writable ? <form className="asset-upload-form" onSubmit={upload}>
      <label><span>{t.type}</span><select onChange={(event: ChangeEvent<HTMLSelectElement>) => setType(event.target.value as AssetType)} value={type}>{allowedTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>{t.upload}</span><input accept="image/jpeg,image/png,image/webp,image/gif,image/avif" name="file" required type="file" /></label>
      <button className="primary-button" disabled={status === "busy"} type="submit">{status === "busy" ? t.uploading : t.upload}</button>
    </form> : <p className="notice-box">{t.readOnly}</p>}
    {status === "error" ? <p className="error-text">{error || t.failed}</p> : null}
  </section>;
}
