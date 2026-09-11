import { useEffect, useRef, useState } from "react";

import { normalizeNfoCode } from "@/application/importers/nfo-filename-metadata";
import { WORK_TYPE_DEFINITIONS } from "@/application/importers/import-classification-normalizer";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import { localizeGenre } from "@/application/services/genre-localization-service";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Tag } from "@/domain/entities/classification";
import type { Work, WorkPersonRelation } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";
import { compactLocalizedText, datePrecision, isPositiveInteger, isValidPartialDate, message } from "./desktop-management-utils";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useUiConfirm } from "./ui/confirm-dialog";
import { UiActionDialog } from "./ui/action-dialog";

/** Desktop Work 的新建与编辑表单；查询和文件写入仍通过 Repository 完成。 */
export function CreateWorkPanel({
  repository,
  onSaved,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  onSaved: (work: Work) => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionJa, setDescriptionJa] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [busy, setBusy] = useState(false);
  const operationPending = useRef(false);

  async function save(): Promise<void> {
    if (operationPending.current) return;
    const normalizedCode = normalizeNfoCode(code.trim()) ?? code.trim().toUpperCase();
    // Canonical Work 保存的是按语言分开的 LocalizedText。这里与编辑页共用相同的
    // 压缩规则，避免新建时先把中文塞进日文字段，之后还要靠用户手工纠正。
    const titles = compactLocalizedText({ ja: titleJa, "zh-CN": titleZh, en: titleEn });
    const descriptions = compactLocalizedText({ ja: descriptionJa, "zh-CN": descriptionZh, en: descriptionEn });
    if (!normalizedCode || !Object.keys(titles).length) {
      setMessage(t("新建 Work 至少需要番号和标题。"));
      return;
    }
    operationPending.current = true;
    setBusy(true);
    try {
      const existing = await repository.findWorkByCode(normalizedCode);
      if (existing) throw new Error(t("番号 {code} 已存在。", { code: normalizedCode }));
      const now = new Date().toISOString();
      const work: Work = {
        schemaVersion: 1,
        id: `work_${crypto.randomUUID()}`,
        code: normalizedCode,
        originalLanguage: "ja",
        titles,
        ...(Object.keys(descriptions).length ? { descriptions } : {}),
        workTypeIds: [],
        personRelations: [],
        seriesIds: [],
        genreIds: [],
        tagIds: [],
        assetIds: [],
        mediaFileIds: [],
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveWork(work);
      setCode("");
      setTitleJa("");
      setTitleZh("");
      setTitleEn("");
      setDescriptionJa("");
      setDescriptionZh("");
      setDescriptionEn("");
      setOpen(false);
      setMessage(t("已在 Private Library 新建 Work {code}。", { code: work.code }));
      onSaved(work);
    } catch (error) {
      setMessage(t("新建 Work 失败：{error}", { error: message(error) }));
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  return <section className="settings-card compact-management-card">
    <div className="section-heading">
      <div><span className="eyebrow">PRIVATE CRUD</span><h2>{t("新建作品")}</h2><p className="muted">{t("直接创建最小 Canonical Work；完整关系可进入详情页继续编辑。")}</p></div>
      <button className={open ? "ghost-button" : "primary-button"} disabled={busy} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("+ 新建 Work")}</button>
    </div>
    {open ? <fieldset className="editor-grid" disabled={busy}>
      <label>{t("番号")}<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MIDV-077" /></label>
      <label>{t("日文标题")}<input value={titleJa} onChange={(event) => setTitleJa(event.target.value)} placeholder={t("作品标题")} /></label>
      <label>{t("中文标题")}<input value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></label>
      <label>{t("英文标题")}<input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></label>
      <label>{t("日文简介")}<textarea value={descriptionJa} onChange={(event) => setDescriptionJa(event.target.value)} rows={4} /></label>
      <label>{t("中文简介")}<textarea value={descriptionZh} onChange={(event) => setDescriptionZh(event.target.value)} rows={4} /></label>
      <label className="span-2">{t("英文简介")}<textarea value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} rows={4} /></label>
      <div className="span-2 form-actions"><button className="primary-button" onClick={() => void save()}>{busy ? t("保存中…") : t("创建")}</button></div>
    </fieldset> : null}
  </section>;
}

interface WorkEditorProps {
  repository: TauriLibraryRepository;
  work: Work;
  onSaved: () => void;
  onDeleted: () => void;
  setMessage: (message: string) => void;
}

/** 取消意味着丢弃未保存草稿。重新挂载编辑会话同时清理关系选择和暂存 Tag，且不写磁盘。 */
export function WorkEditor(props: WorkEditorProps) {
  const [session, setSession] = useState(0);
  const [open, setOpen] = useState(false);
  const { t } = useDesktopI18n();
  function closeAndReset(): void {
    setOpen(false);
    setSession((value) => value + 1);
  }
  return <>
    <button className="primary-button desktop-work-edit-trigger" type="button" onClick={() => setOpen(true)}>{t("编辑作品")}</button>
    <UiActionDialog wide open={open} onOpenChange={(next) => { if (!next) closeAndReset(); }} title={t("编辑作品")} description={t("集中修改作品信息，保存后返回当前详情。明确信息来源后再改动事实字段。")} closeLabel={t("关闭")}>
      <WorkEditorSession key={session} {...props} onSaved={() => { props.onSaved(); setOpen(false); setSession((value) => value + 1); }} onCancel={closeAndReset} />
    </UiActionDialog>
  </>;
}

function WorkEditorSession({
  repository,
  work,
  onSaved,
  onDeleted,
  setMessage,
  onCancel,
}: WorkEditorProps & { onCancel: () => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const confirm = useUiConfirm();
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const operationPending = useRef(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [genreOptions, setGenreOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; label: string }>>([]);

  const [code, setCode] = useState(work.code);
  const [titleJa, setTitleJa] = useState(work.titles.ja ?? "");
  const [titleZh, setTitleZh] = useState(work.titles["zh-CN"] ?? "");
  const [titleEn, setTitleEn] = useState(work.titles.en ?? "");
  const [descriptionJa, setDescriptionJa] = useState(work.descriptions?.ja ?? "");
  const [descriptionZh, setDescriptionZh] = useState(work.descriptions?.["zh-CN"] ?? "");
  const [descriptionEn, setDescriptionEn] = useState(work.descriptions?.en ?? "");
  const [releaseDate, setReleaseDate] = useState(work.releaseDate?.value ?? "");
  const [duration, setDuration] = useState(work.durationMinutes ? String(work.durationMinutes) : "");
  const [makerId, setMakerId] = useState(work.makerId ?? "");
  const [labelId, setLabelId] = useState(work.labelId ?? "");
  const [performerIds, setPerformerIds] = useState(work.personRelations.filter((item) => item.role === "performer").map((item) => item.personId));
  const [directorIds, setDirectorIds] = useState(work.personRelations.filter((item) => item.role === "director").map((item) => item.personId));
  const [workTypeIds, setWorkTypeIds] = useState(work.workTypeIds);
  const [seriesIds, setSeriesIds] = useState(work.seriesIds);
  const [genreIds, setGenreIds] = useState(work.genreIds);
  const [tagIds, setTagIds] = useState(work.tagIds);
  const [customTagName, setCustomTagName] = useState("");
  const [pendingTags, setPendingTags] = useState<Tag[]>([]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      repository.isPrivateEntity("works", work.id),
      repository.listPeople({ page: 1, pageSize: 100000, sort: "name_asc" }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
    ]).then(([privateEntity, peopleResult, organizationResult, seriesResult, genreResult, tagResult]) => {
      if (disposed) return;
      setIsPrivate(privateEntity);
      setPeople(peopleResult.items);
      setOrganizations(organizationResult);
      setSeriesOptions(seriesResult.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage) })));
      setGenreOptions(genreResult.map((item) => ({ id: item.id, label: localizeGenre(item, metadataLanguage, item.id) })));
      setTagOptions(tagResult.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage) })));
    }).catch((error) => setMessage(t("无法读取编辑选项：{error}", { error: message(error) })));
    return () => { disposed = true; };
  }, [repository, work.id, setMessage, metadataLanguage, t]);

  const makers = organizations.filter((item) => item.kind === "maker");
  const labels = organizations.filter((item) => item.kind === "label");

  function addCustomTag(): void {
    const name = customTagName.normalize("NFKC").trim();
    if (!name) return;
    const normalized = name.toLocaleLowerCase();
    const existing = tagOptions.find((option) => option.label.normalize("NFKC").trim().toLocaleLowerCase() === normalized);
    if (existing) {
      setTagIds((current) => current.includes(existing.id) ? current : [...current, existing.id]);
      setCustomTagName("");
      return;
    }
    // 自定义 Tag 是用户的 Canonical 私人分类；先在表单内暂存，保存 Work 时再按引用安全顺序写入。
    const tag: Tag = {
      id: `tag_user_${crypto.randomUUID()}`,
      names: { [metadataLanguage]: name },
      builtIn: false,
    };
    setPendingTags((current) => [...current, tag]);
    setTagOptions((current) => [...current, { id: tag.id, label: name }].sort((a, b) => a.label.localeCompare(b.label)));
    setTagIds((current) => [...current, tag.id]);
    setCustomTagName("");
  }

  async function save(): Promise<void> {
    if (operationPending.current) return;
    const normalizedCode = normalizeNfoCode(code.trim()) ?? code.trim().toUpperCase();
    const titles = compactLocalizedText({ ja: titleJa, "zh-CN": titleZh, en: titleEn });
    const descriptions = compactLocalizedText({ ja: descriptionJa, "zh-CN": descriptionZh, en: descriptionEn });
    if (!normalizedCode || !Object.keys(titles).length) {
      setMessage(t("Work 的番号和标题不能为空。"));
      return;
    }
    if (releaseDate.trim() && !isValidPartialDate(releaseDate.trim())) {
      setMessage(t("发行日期必须是有效的 YYYY、YYYY-MM 或 YYYY-MM-DD。"));
      return;
    }
    if (duration.trim() && !isPositiveInteger(duration.trim())) {
      setMessage(t("时长必须是大于 0 的整数分钟。"));
      return;
    }
    operationPending.current = true;
    setBusy(true);
    try {
      const existingCode = await repository.findWorkByCode(normalizedCode);
      if (existingCode && existingCode.id !== work.id) {
        throw new Error(t("番号 {code} 已由其它 Work 使用。", { code: normalizedCode }));
      }
      const relations: WorkPersonRelation[] = [
        ...performerIds.map((personId, index) => ({ personId, role: "performer" as const, billingOrder: index + 1 })),
        ...directorIds.map((personId, index) => ({ personId, role: "director" as const, billingOrder: index + 1 })),
        ...work.personRelations.filter((item) => item.role !== "performer" && item.role !== "director"),
      ];
      const next: Work = {
        ...work,
        code: normalizedCode,
        titles,
        ...(Object.keys(descriptions).length ? { descriptions } : {}),
        ...(releaseDate.trim() ? { releaseDate: { value: releaseDate.trim(), precision: datePrecision(releaseDate.trim()) } } : {}),
        ...(duration.trim() ? { durationMinutes: Number(duration) } : {}),
        personRelations: dedupeRelations(relations),
        workTypeIds,
        ...(makerId ? { makerId } : {}),
        ...(labelId ? { labelId } : {}),
        seriesIds,
        genreIds,
        tagIds,
        updatedAt: new Date().toISOString(),
      };
      if (!Object.keys(descriptions).length) delete next.descriptions;
      if (!releaseDate.trim()) delete next.releaseDate;
      if (!duration.trim()) delete next.durationMinutes;
      if (!makerId) delete next.makerId;
      if (!labelId) delete next.labelId;
      // JSON V1 不具有跨文件事务：先写被 Work 引用的新 Tag，避免任何时刻出现悬空引用。
      for (const tag of pendingTags.filter((item) => tagIds.includes(item.id))) await repository.saveTag(tag);
      await repository.saveWork(next);
      setPendingTags([]);
      setIsPrivate(true);
      setMessage(isPrivate ? t("已更新 {code}。", { code: next.code }) : t("已为 Shared Work {code} 创建 Private Override。", { code: next.code }));
      onSaved();
    } catch (error) {
      setMessage(t("保存 Work 失败：{error}", { error: message(error) }));
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (operationPending.current) return;
    if (!isPrivate || !await confirm({ title: t("确认"), description: t("删除 Private Work {code}？如 Shared Pack 中存在同 ID，删除后会重新显示 Shared 版本。", { code: work.code }), confirmLabel: t("删除"), dangerous: true })) return;
    operationPending.current = true;
    setBusy(true);
    try {
      await repository.deletePrivateWork(work.id);
      setMessage(t("已删除 Private Work {code}。", { code: work.code }));
      onDeleted();
    } catch (error) {
      setMessage(t("删除 Work 失败：{error}", { error: message(error) }));
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  return <div className="desktop-work-editor-dialog"><p className="muted">{isPrivate ? t("当前实体来自 Private Library，可直接编辑。") : t("当前来自 Shared Pack；保存会建立同 ID 的 Private Override，不修改 Shared Pack。")}</p><fieldset className="editor-grid" disabled={busy}>
      <h3 className="span-2 desktop-editor-section-title">{t("基础信息")}</h3>
      <label>{t("番号")}<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label>{t("日文标题")}<input value={titleJa} onChange={(event) => setTitleJa(event.target.value)} /></label>
      <label>{t("中文标题")}<input value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></label>
      <label className="span-2">{t("英文标题")}<input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></label>
      <label>{t("发行日期")}<input value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} placeholder="2026-09-03 / 2026-09 / 2026" /></label>
      <label>{t("时长（分钟）")}<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
      <h3 className="span-2 desktop-editor-section-title">{t("作品简介")}</h3>
      <label>{t("日文简介")}<textarea value={descriptionJa} onChange={(event) => setDescriptionJa(event.target.value)} rows={4} /></label>
      <label>{t("中文简介")}<textarea value={descriptionZh} onChange={(event) => setDescriptionZh(event.target.value)} rows={4} /></label>
      <label className="span-2">{t("英文简介")}<textarea value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} rows={4} /></label>
      <h3 className="span-2 desktop-editor-section-title">{t("关系与分类")}</h3>
      <label>{t("厂商")}<select value={makerId} onChange={(event) => setMakerId(event.target.value)}><option value="">{t("未设置")}</option>{makers.map((item) => <option key={item.id} value={item.id}>{localizeText(item.names, metadataLanguage, item.id)}</option>)}</select></label>
      <label>{t("厂牌")}<select value={labelId} onChange={(event) => setLabelId(event.target.value)}><option value="">{t("未设置")}</option>{labels.map((item) => <option key={item.id} value={item.id}>{localizeText(item.names, metadataLanguage, item.id)}</option>)}</select></label>
      <ChoicePicker label={t("演员")} values={performerIds} onChange={setPerformerIds} options={people.map((item) => ({ id: item.id, label: getPreferredPersonName(item, metadataLanguage), searchNames: item.names.map((name) => name.value) }))} />
      <ChoicePicker label={t("导演")} values={directorIds} onChange={setDirectorIds} options={people.map((item) => ({ id: item.id, label: getPreferredPersonName(item, metadataLanguage), searchNames: item.names.map((name) => name.value) }))} />
      <ChoicePicker label={t("作品类型")} values={workTypeIds} onChange={setWorkTypeIds} options={WORK_TYPE_DEFINITIONS.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage, item.id) }))} />
      <ChoicePicker label={t("系列")} values={seriesIds} onChange={setSeriesIds} options={seriesOptions} />
      <ChoicePicker label={t("题材")} values={genreIds} onChange={setGenreIds} options={genreOptions} />
      <div className="work-tag-editor">
        <ChoicePicker label={t("自定义标签")} values={tagIds} onChange={setTagIds} options={tagOptions} />
        <div className="work-tag-editor__create">
          <input value={customTagName} onChange={(event) => setCustomTagName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }} placeholder={t("输入新标签名称")} />
          <button disabled={!customTagName.trim()} onClick={addCustomTag} type="button">{t("创建并选中")}</button>
        </div>
      </div>
      <div className="span-2 form-actions desktop-work-editor-actions">{isPrivate ? <button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("删除 Private Work")}</button> : <span />}<button onClick={onCancel}>{t("取消")}</button><button className="primary-button" onClick={() => void save()}>{busy ? t("保存中…") : isPrivate ? t("保存修改") : t("保存为 Private Override")}</button></div>
    </fieldset></div>;
}

function ChoicePicker({ label, options, values, onChange }: { label: string; options: Array<{ id: string; label: string; searchNames?: string[] }>; values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useDesktopI18n();
  const [search, setSearch] = useState("");
  const optionById = new Map(options.map((option) => [option.id, option]));
  // 搜索命中别名不改变显示主名，也不创建或合并人物；选中结果仍使用稳定 ID。
  const keyword = search.normalize("NFKC").trim().toLocaleLowerCase();
  const available = options
    .filter((option) => !values.includes(option.id) && [option.label, ...(option.searchNames ?? [])].some((name) => name.normalize("NFKC").toLocaleLowerCase().includes(keyword)))
    .slice(0, 40);
  return <fieldset className="choice-picker">
    <legend>{label}</legend>
    <div className="choice-picker__selected">
      {values.map((id) => <button aria-label={t("移除 {name}", { name: optionById.get(id)?.label ?? id })} key={id} onClick={() => onChange(values.filter((value) => value !== id))} type="button">{optionById.get(id)?.label ?? id}<span>×</span></button>)}
      {!values.length ? <small>{t("尚未选择")}</small> : null}
    </div>
    <details className="choice-picker__menu">
      <summary>{t("添加或搜索")}</summary>
      <input aria-label={t("搜索 {label}", { label })} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("输入关键词…")} />
      <div className="choice-picker__options">
        {available.map((option) => <button key={option.id} onClick={() => onChange([...values, option.id])} type="button">+ {option.label}</button>)}
        {!available.length ? <small>{t("没有可添加的匹配项")}</small> : null}
      </div>
    </details>
  </fieldset>;
}

function dedupeRelations(values: WorkPersonRelation[]): WorkPersonRelation[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.personId}\0${item.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 空输入不写入 JSON，避免语言切换把空字符串误当成有效翻译。 */
