"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import type { PortablePackPreview } from "@/domain/entities/portable-pack";

export function PackImportWorkbench() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PortablePackPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "preview" | "import") {
    if (!file) { setMessage("请选择 .localogue-pack 文件。"); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file); form.set("action", action);
      const response = await fetch("/api/packs/import", { method: "POST", body: form });
      const body = await response.json() as { preview?: PortablePackPreview; result?: { imported: number; skipped: number; sharedPackPath?: string; warnings?: string[] }; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Pack 操作失败。");
      if (action === "preview") setPreview(body.preview ?? null);
      else { setMessage(`导入完成：${body.result?.imported ?? 0} 个文件，跳过 ${body.result?.skipped ?? 0} 个。${body.result?.sharedPackPath ? ` 已挂载 ${body.result.sharedPackPath}` : ""}`); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null); setPreview(null); setMessage(""); }

  return <section className="settings-card">
    <span className="eyebrow">PORTABLE IMPORT</span><h2>导入 .localogue-pack</h2>
    <p className="muted">先预览再导入。Personal Pack 默认只补缺失文件，不覆盖现有私人资料；Shared Pack 通过 Community Validator 后安装到 .localogue/packs 并自动挂载。</p>
    <input accept=".localogue-pack,application/vnd.localogue.pack" onChange={choose} type="file" />
    <div className="inline-actions"><button className="secondary-button" disabled={!file || busy} onClick={()=>void submit("preview")} type="button">预览</button><button className="primary-button" disabled={!preview?.importable || busy} onClick={()=>void submit("import")} type="button">确认导入</button></div>
    {preview ? <div className="pack-preview"><strong>{preview.manifest.name}</strong><p>{preview.manifest.kind} · {preview.manifest.version} · {preview.fileCount} files</p><p>{formatBytes(preview.totalBytes)}</p>{preview.conflicts.length ? <p className="warning-text">现有冲突 {preview.conflicts.length} 个，导入时会跳过。</p> : null}{preview.errors.map((item)=><p className="error-text" key={item}>{item}</p>)}{preview.warnings.map((item)=><p className="warning-text" key={item}>{item}</p>)}</div> : null}
    {message ? <p className="muted">{message}</p> : null}
  </section>;
}
function formatBytes(value: number) { if (!value) return "0 B"; const units=["B","KB","MB","GB"]; const i=Math.min(Math.floor(Math.log(value)/Math.log(1024)),units.length-1); return `${(value/1024**i).toFixed(i?1:0)} ${units[i]}`; }
