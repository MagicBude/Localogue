import { useEffect, useState } from "react";

import { inferCatalogFilenameMetadata } from "@/application/importers/nfo-filename-metadata";
import { localizeText } from "@/application/services/localization-service";
import type { MediaBindingReceipt } from "@/domain/entities/media-binding";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Work } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";

/**
 * 人工媒体绑定是独立的治理用例：候选搜索只帮助用户判断，永远不会自动保存 Work 关系。
 * 真正写入发生在 bind 中，并和 Media Binding Receipt 组成一个需要补偿回滚的整体。
 */
export function MediaBindingPanel({ media, repository, onChanged, setMessage }: { media: MediaFile; repository: TauriLibraryRepository; onChanged: () => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  // query 是可编辑的搜索条件；works 是候选快照。候选本身不代表系统已经认可关联。
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<Work[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    // 文件名番号只是搜索起点。它用于缩小候选范围，不会绕过用户点击“绑定”的明确决定。
    const initial = inferCatalogFilenameMetadata(media.fileName).code ?? "";
    setQuery(initial);
    void repository.listWorks({ ...(initial ? { text: initial } : {}), page: 1, pageSize: 30, sort: "release_desc" })
      .then((result) => { if (!disposed) setWorks(result.items); })
      .catch((error) => { if (!disposed) setMessage(t("查询 Work 候选失败：{error}", { error: message(error) })); });
    // 用户快速切换 MediaFile 时，旧查询可能后返回；disposed 阻止它污染新面板。
    return () => { disposed = true; };
  }, [media.id, media.fileName, repository, setMessage, t]);

  async function search(): Promise<void> {
    setBusy(true);
    try {
      const result = await repository.listWorks({ ...(query.trim() ? { text: query.trim() } : {}), page: 1, pageSize: 50, sort: "release_desc" });
      setWorks(result.items);
    } catch (error) {
      setMessage(t("查询 Work 候选失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function bind(nextWorkId: string | null): Promise<void> {
    setBusy(true);
    const before = media.workId;
    try {
      // 在写入前重新确认目标存在，避免候选列表过期后产生悬空 workId。
      if (nextWorkId) {
        const target = await repository.findWorkById(nextWorkId);
        if (!target) throw new Error(t("目标 Work 不存在。"));
      }
      const updated: MediaFile = { ...media, updatedAt: new Date().toISOString() };
      if (nextWorkId) {
        updated.workId = nextWorkId;
        updated.matchMethod = "manual";
      } else {
        delete updated.workId;
        delete updated.matchMethod;
      }
      await repository.saveMediaFile(updated);
      try {
        // Receipt 保存 before/after，使 bind、rebind、unbind 都能被审计，而不只保留最终值。
        const receipt: MediaBindingReceipt = {
          schemaVersion: 1,
          id: `media_binding_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          mediaFileId: media.id,
          mediaFilePath: media.path,
          ...(before ? { beforeWorkId: before } : {}),
          ...(nextWorkId ? { afterWorkId: nextWorkId } : {}),
          action: before && nextWorkId ? "rebind" : nextWorkId ? "bind" : "unbind",
          changedAt: new Date().toISOString(),
        };
        await repository.saveMediaBindingReceipt(receipt);
      } catch (error) {
        // JSON 写入不具备跨文件事务：Receipt 失败时把 MediaFile 恢复成调用前对象。
        await repository.saveMediaFile(media);
        throw new Error(t("绑定审计 Receipt 写入失败，已回滚 MediaFile：{error}", { error: message(error) }));
      }
      setMessage(nextWorkId ? t("已保存人工 Work 绑定，并记录 Media Binding Receipt。") : t("已解除 Work 绑定，并记录 Media Binding Receipt。"));
      onChanged();
    } catch (error) {
      setMessage(t("媒体绑定失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  return <section className="settings-card binding-panel"><div className="section-heading"><div><span className="eyebrow">MANUAL MEDIA RESOLUTION</span><h2>{t("人工绑定")}：{media.fileName}</h2><p className="muted">{t("自动扫描只做保守番号匹配。这里可以搜索、绑定、重新绑定或解除，并写入 Private 审计 Receipt。")}</p></div>{media.workId ? <button className="danger-button" disabled={busy} onClick={() => void bind(null)}>{t("解除绑定")}</button> : null}</div><div className="binding-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索番号或标题")} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} /><button disabled={busy} onClick={() => void search()}>{busy ? t("查询中…") : t("搜索")}</button></div><div className="candidate-list">{works.map((work) => <article className="candidate-card" key={work.id}><div><strong>{work.code}</strong><p>{localizeText(work.titles, metadataLanguage)}</p><small>{work.id}</small></div><button className="primary-button" disabled={busy || media.workId === work.id} onClick={() => void bind(work.id)}>{media.workId === work.id ? t("当前绑定") : media.workId ? t("重新绑定") : t("绑定")}</button></article>)}{!works.length ? <p className="muted">{t("没有候选。尝试输入番号或标题。")} </p> : null}</div></section>;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
