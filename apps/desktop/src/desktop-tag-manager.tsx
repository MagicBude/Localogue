import { useEffect, useMemo, useState } from "react";

import { localizeText } from "@/application/services/localization-service";
import type { Tag } from "@/domain/entities/classification";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

import { useDesktopI18n } from "./desktop-i18n";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { UiActionDialog } from "./ui/action-dialog";
import { UiButton } from "./ui/button";

/**
 * Tag Manager 只管理用户 Tag 的私人展示结构。
 * category / order 不是 Genre，不会改变 WorkQuery 的 Tag ID；编辑 Shared Tag
 * 时仍由 Repository 写入同 ID Private Override，Shared Pack 始终只读。
 */
export function DesktopTagManager({ repository, tags, metadataLanguage, onChanged, setMessage }: {
  repository: TauriLibraryRepository;
  tags: Tag[];
  metadataLanguage: SupportedLanguage;
  onChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [privateIds, setPrivateIds] = useState<Set<string>>(new Set());
  const [newCategory, setNewCategory] = useState("");
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    void Promise.all(tags.map(async (tag) => [tag.id, await repository.isPrivateEntity("tags", tag.id)] as const))
      .then((pairs) => { if (!disposed) setPrivateIds(new Set(pairs.filter(([, value]) => value).map(([id]) => id))); })
      .catch((error) => setMessage(t("读取标签归属失败：{error}", { error: toMessage(error) })));
    return () => { disposed = true; };
  }, [open, repository, setMessage, t, tags]);

  const categories = useMemo(() => {
    const order = new Map<string, number>();
    for (const tag of tags) if (tag.category) order.set(tag.category, Math.min(order.get(tag.category) ?? Number.MAX_SAFE_INTEGER, tag.categoryOrder ?? Number.MAX_SAFE_INTEGER));
    for (const category of localCategories) if (!order.has(category)) order.set(category, Number.MAX_SAFE_INTEGER);
    return [...order].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  }, [localCategories, tags]);

  const sortedTags = useMemo(() => [...tags].sort((a, b) => {
    const categoryA = a.category ? categories.indexOf(a.category) : categories.length;
    const categoryB = b.category ? categories.indexOf(b.category) : categories.length;
    return categoryA - categoryB
      || (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || tagLabel(a, metadataLanguage).localeCompare(tagLabel(b, metadataLanguage));
  }), [categories, metadataLanguage, tags]);

  function createCategory(): void {
    const name = newCategory.normalize("NFKC").trim();
    if (!name || categories.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    setLocalCategories((current) => [...current, name]);
    setNewCategory("");
  }

  async function saveTag(next: Tag, success: string): Promise<void> {
    setBusyId(next.id);
    try {
      await repository.saveTag(next);
      setMessage(success);
      onChanged();
    } catch (error) {
      setMessage(t("保存标签失败：{error}", { error: toMessage(error) }));
    } finally {
      setBusyId(undefined);
    }
  }

  async function assignCategory(tag: Tag, category: string): Promise<void> {
    const next = { ...tag, category: category || undefined, categoryOrder: category ? Math.max(0, categories.indexOf(category)) : undefined };
    if (!next.category) { delete next.category; delete next.categoryOrder; }
    await saveTag(next, t("已更新标签分类。"));
  }

  async function moveCategory(category: string, direction: -1 | 1): Promise<void> {
    const from = categories.indexOf(category);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= categories.length) return;
    const reordered = [...categories];
    [reordered[from], reordered[to]] = [reordered[to]!, reordered[from]!];
    setBusyId(`category:${category}`);
    try {
      // 顺序只是展示元数据；即使中途失败，Tag ID 与 Work 引用仍然完整，重试即可收敛。
      for (const tag of tags.filter((item) => item.category)) {
        await repository.saveTag({ ...tag, categoryOrder: reordered.indexOf(tag.category!) });
      }
      setLocalCategories(reordered.filter((name) => !tags.some((tag) => tag.category === name)));
      setMessage(t("已调整标签分类顺序。"));
      onChanged();
    } catch (error) {
      setMessage(t("调整分类顺序失败：{error}", { error: toMessage(error) }));
    } finally {
      setBusyId(undefined);
    }
  }

  async function removeTag(tag: Tag): Promise<void> {
    if (!privateIds.has(tag.id)) return;
    setBusyId(tag.id);
    try {
      await repository.deletePrivateTag(tag.id);
      setPendingDelete(null);
      setMessage(t("已删除私人标签。"));
      onChanged();
    } catch (error) {
      setMessage(t("删除标签失败：{error}", { error: toMessage(error) }));
    } finally {
      setBusyId(undefined);
    }
  }

  return <>
    <UiButton onClick={() => setOpen(true)} variant="ghost">{t("管理标签")}</UiButton>
    <UiActionDialog
      actions={<UiButton onClick={() => setOpen(false)}>{t("完成")}</UiButton>}
      closeLabel={t("关闭")}
      description={t("分类只整理私人 Tag，不会把 Tag 变成 Genre。所有修改即时保存。")}
      onOpenChange={setOpen}
      open={open}
      title={t("标签管理")}
    >
      <div className="tag-manager">
        <div className="tag-manager__new-category">
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createCategory(); } }} placeholder={t("新分类名称")} />
          <UiButton disabled={!newCategory.trim()} onClick={createCategory}>{t("新增分类")}</UiButton>
        </div>
        {categories.length ? <div className="tag-manager__categories">
          {categories.map((category, index) => <div key={category}><strong>{category}</strong><small>{t("{count} 个标签", { count: tags.filter((tag) => tag.category === category).length })}</small><div><button disabled={index === 0 || Boolean(busyId)} onClick={() => void moveCategory(category, -1)} type="button">↑</button><button disabled={index === categories.length - 1 || Boolean(busyId)} onClick={() => void moveCategory(category, 1)} type="button">↓</button></div></div>)}
        </div> : null}
        <div className="tag-manager__list">
          {sortedTags.map((tag) => <div key={tag.id}>
            <span><strong>{tagLabel(tag, metadataLanguage)}</strong><small>{privateIds.has(tag.id) ? "Private" : "Shared / built-in"}</small></span>
            <select disabled={busyId === tag.id} value={tag.category ?? ""} onChange={(event) => void assignCategory(tag, event.target.value)}><option value="">{t("未分类")}</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <UiButton disabled={!privateIds.has(tag.id) || busyId === tag.id} onClick={() => setPendingDelete(tag)} variant="danger">{t("删除")}</UiButton>
          </div>)}
        </div>
      </div>
    </UiActionDialog>
    <UiActionDialog
      actions={<><UiButton onClick={() => setPendingDelete(null)} variant="ghost">{t("取消")}</UiButton><UiButton disabled={Boolean(busyId)} onClick={() => { if (pendingDelete) void removeTag(pendingDelete); }} variant="danger">{t("删除")}</UiButton></>}
      closeLabel={t("关闭")}
      description={pendingDelete ? t("删除私人标签“{name}”？仍被作品使用时会自动阻止。", { name: tagLabel(pendingDelete, metadataLanguage) }) : ""}
      onOpenChange={(value) => { if (!value) setPendingDelete(null); }}
      open={Boolean(pendingDelete)}
      title={t("删除标签")}
    />
  </>;
}

function tagLabel(tag: Tag, language: SupportedLanguage): string {
  return localizeText(tag.names, language, tag.id);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
