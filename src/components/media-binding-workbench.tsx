"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { MediaBindingCandidate } from "@/domain/entities/media-binding";

export function MediaBindingWorkbench({ mediaFileId, currentWorkId }: { mediaFileId: string; currentWorkId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<MediaBindingCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void loadCandidates(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCandidates(q: string) {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/media/${encodeURIComponent(mediaFileId)}/candidates?q=${encodeURIComponent(q)}`);
      const body = await response.json() as { candidates?: MediaBindingCandidate[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "候选查询失败。");
      setCandidates(body.candidates ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }

  async function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await loadCandidates(query); }

  async function bind(workId: string | null) {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/media/${encodeURIComponent(mediaFileId)}/binding`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ workId }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "绑定失败。");
      setMessage(workId ? "已保存人工绑定。" : "已解除 Work 绑定。");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }

  return <section className="settings-card">
    <div className="section-heading-row"><div><span className="eyebrow">MANUAL RESOLUTION</span><h2>人工绑定作品</h2></div>
      {currentWorkId ? <button className="danger-button" disabled={loading} onClick={()=>void bind(null)} type="button">解除绑定</button> : null}
    </div>
    <p className="muted">候选只用于辅助判断，不会自动修改 MediaFile。只有你点击“绑定”后才写入，并保存绑定审计 Receipt。</p>
    <form className="media-binding-search" onSubmit={search}>
      <input onChange={(event: ChangeEvent<HTMLInputElement>)=>setQuery(event.target.value)} placeholder="搜索番号或标题，例如 DEMO-001" value={query} />
      <button className="secondary-button" disabled={loading} type="submit">{loading ? "查询中…" : "搜索"}</button>
    </form>
    {message ? <p className="muted">{message}</p> : null}
    <div className="candidate-list">
      {candidates.map((candidate)=><article className="candidate-card" key={candidate.workId}>
        <div><strong>{candidate.code}</strong><p>{candidate.title}</p><small>{candidate.reasons.join(" · ") || "手工搜索结果"}{candidate.score ? ` · score ${candidate.score}` : ""}</small></div>
        <button className="primary-button" disabled={loading || candidate.workId === currentWorkId} onClick={()=>void bind(candidate.workId)} type="button">{candidate.workId === currentWorkId ? "当前绑定" : "绑定"}</button>
      </article>)}
      {!loading && !candidates.length ? <p className="muted">没有自动候选。可以输入番号或标题手工搜索。</p> : null}
    </div>
  </section>;
}
