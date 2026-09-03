import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { inferCatalogFilenameMetadata, normalizeNfoCode } from "@/application/importers/nfo-filename-metadata";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import type { MediaBindingReceipt } from "@/domain/entities/media-binding";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Organization } from "@/domain/entities/organization";
import type { Person, PersonActivityStatus } from "@/domain/entities/person";
import type { Work, WorkPersonRelation } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";

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
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    const normalizedCode = normalizeNfoCode(code.trim()) ?? code.trim().toUpperCase();
    const normalizedTitle = title.trim();
    if (!normalizedCode || !normalizedTitle) {
      setMessage(t("新建 Work 至少需要番号和标题。"));
      return;
    }
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
        titles: { ja: normalizedTitle },
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
      setTitle("");
      setOpen(false);
      setMessage(t("已在 Private Library 新建 Work {code}。", { code: work.code }));
      onSaved(work);
    } catch (error) {
      setMessage(t("新建 Work 失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  return <section className="settings-card compact-management-card">
    <div className="section-heading">
      <div><span className="eyebrow">PRIVATE CRUD</span><h2>{t("新建作品")}</h2><p className="muted">{t("直接创建最小 Canonical Work；完整关系可进入详情页继续编辑。")}</p></div>
      <button className={open ? "ghost-button" : "primary-button"} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("+ 新建 Work")}</button>
    </div>
    {open ? <div className="inline-form-grid">
      <label>{t("番号")}<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MIDV-077" /></label>
      <label>{t("日文标题")}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("作品标题")} /></label>
      <div className="form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : t("创建")}</button></div>
    </div> : null}
  </section>;
}

export function WorkEditor({
  repository,
  work,
  onSaved,
  onDeleted,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  work: Work;
  onSaved: () => void;
  onDeleted: () => void;
  setMessage: (message: string) => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [genreOptions, setGenreOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; label: string }>>([]);

  const [code, setCode] = useState(work.code);
  const [title, setTitle] = useState(localizeText(work.titles, "ja", ""));
  const [description, setDescription] = useState(localizeText(work.descriptions, "zh-CN", ""));
  const [releaseDate, setReleaseDate] = useState(work.releaseDate?.value ?? "");
  const [duration, setDuration] = useState(work.durationMinutes ? String(work.durationMinutes) : "");
  const [makerId, setMakerId] = useState(work.makerId ?? "");
  const [labelId, setLabelId] = useState(work.labelId ?? "");
  const [performerIds, setPerformerIds] = useState(work.personRelations.filter((item) => item.role === "performer").map((item) => item.personId));
  const [directorIds, setDirectorIds] = useState(work.personRelations.filter((item) => item.role === "director").map((item) => item.personId));
  const [seriesIds, setSeriesIds] = useState(work.seriesIds);
  const [genreIds, setGenreIds] = useState(work.genreIds);
  const [tagIds, setTagIds] = useState(work.tagIds);

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
      setGenreOptions(genreResult.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage) })));
      setTagOptions(tagResult.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage) })));
    }).catch((error) => setMessage(t("无法读取编辑选项：{error}", { error: message(error) })));
    return () => { disposed = true; };
  }, [repository, work.id, setMessage, metadataLanguage, t]);

  const makers = organizations.filter((item) => item.kind === "maker");
  const labels = organizations.filter((item) => item.kind === "label");

  async function save(): Promise<void> {
    const normalizedCode = normalizeNfoCode(code.trim()) ?? code.trim().toUpperCase();
    const normalizedTitle = title.trim();
    if (!normalizedCode || !normalizedTitle) {
      setMessage(t("Work 的番号和标题不能为空。"));
      return;
    }
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
        titles: { ...work.titles, ja: normalizedTitle },
        ...(description.trim() ? { descriptions: { ...work.descriptions, "zh-CN": description.trim() } } : {}),
        ...(releaseDate.trim() ? { releaseDate: { value: releaseDate.trim(), precision: datePrecision(releaseDate.trim()) } } : {}),
        ...(duration.trim() && Number(duration) > 0 ? { durationMinutes: Number(duration) } : {}),
        personRelations: dedupeRelations(relations),
        ...(makerId ? { makerId } : {}),
        ...(labelId ? { labelId } : {}),
        seriesIds,
        genreIds,
        tagIds,
        updatedAt: new Date().toISOString(),
      };
      if (!description.trim()) delete next.descriptions;
      if (!releaseDate.trim()) delete next.releaseDate;
      if (!(duration.trim() && Number(duration) > 0)) delete next.durationMinutes;
      if (!makerId) delete next.makerId;
      if (!labelId) delete next.labelId;
      await repository.saveWork(next);
      setIsPrivate(true);
      setMessage(isPrivate ? t("已更新 {code}。", { code: next.code }) : t("已为 Shared Work {code} 创建 Private Override。", { code: next.code }));
      onSaved();
    } catch (error) {
      setMessage(t("保存 Work 失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!isPrivate || !window.confirm(t("删除 Private Work {code}？如 Shared Pack 中存在同 ID，删除后会重新显示 Shared 版本。", { code: work.code }))) return;
    setBusy(true);
    try {
      await repository.deletePrivateWork(work.id);
      setMessage(t("已删除 Private Work {code}。", { code: work.code }));
      onDeleted();
    } catch (error) {
      setMessage(t("删除 Work 失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  return <section className="settings-card">
    <div className="section-heading">
      <div><span className="eyebrow">DESKTOP EDIT</span><h2>{t("编辑作品")}</h2><p className="muted">{isPrivate ? t("当前实体来自 Private Library，可直接编辑。") : t("当前来自 Shared Pack；保存会建立同 ID 的 Private Override，不修改 Shared Pack。")}</p></div>
      <div className="button-row"><button onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("编辑")}</button>{isPrivate ? <button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("删除 Private Work")}</button> : null}</div>
    </div>
    {open ? <div className="editor-grid">
      <label>{t("番号")}<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label>{t("日文标题")}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="span-2">{t("中文简介")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label>
      <label>{t("发行日期")}<input value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} placeholder="2026-09-03 / 2026-09 / 2026" /></label>
      <label>{t("时长（分钟）")}<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
      <label>{t("厂商")}<select value={makerId} onChange={(event) => setMakerId(event.target.value)}><option value="">{t("未设置")}</option>{makers.map((item) => <option key={item.id} value={item.id}>{localizeText(item.names, metadataLanguage, item.id)}</option>)}</select></label>
      <label>{t("厂牌")}<select value={labelId} onChange={(event) => setLabelId(event.target.value)}><option value="">{t("未设置")}</option>{labels.map((item) => <option key={item.id} value={item.id}>{localizeText(item.names, metadataLanguage, item.id)}</option>)}</select></label>
      <MultiSelect label={t("演员")} values={performerIds} onChange={setPerformerIds} options={people.map((item) => ({ id: item.id, label: getPreferredPersonName(item, metadataLanguage) }))} />
      <MultiSelect label={t("导演")} values={directorIds} onChange={setDirectorIds} options={people.map((item) => ({ id: item.id, label: getPreferredPersonName(item, metadataLanguage) }))} />
      <MultiSelect label={t("系列")} values={seriesIds} onChange={setSeriesIds} options={seriesOptions} />
      <MultiSelect label={t("Genre")} values={genreIds} onChange={setGenreIds} options={genreOptions} />
      <MultiSelect label={t("Tag")} values={tagIds} onChange={setTagIds} options={tagOptions} />
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : isPrivate ? t("保存修改") : t("保存为 Private Override")}</button></div>
    </div> : null}
  </section>;
}

export function CreatePersonPanel({ repository, onSaved, setMessage }: { repository: TauriLibraryRepository; onSaved: (person: Person) => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    if (!name.trim()) { setMessage(t("新建 Person 需要姓名。")); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const person: Person = {
        schemaVersion: 1,
        id: `person_${crypto.randomUUID()}`,
        names: [{ language: "ja", value: name.trim(), type: "primary" }],
        activityStatus: "unknown",
        careerEvents: [],
        galleryAssetIds: [],
        createdAt: now,
        updatedAt: now,
      };
      await repository.savePerson(person);
      setName(""); setOpen(false);
      setMessage(t("已在 Private Library 新建 Person：{name}。", { name: getPreferredPersonName(person, metadataLanguage) }));
      onSaved(person);
    } catch (error) { setMessage(t("新建 Person 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  return <section className="settings-card compact-management-card"><div className="section-heading"><div><span className="eyebrow">PRIVATE CRUD</span><h2>{t("新建人物")}</h2></div><button className={open ? "ghost-button" : "primary-button"} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("+ 新建 Person")}</button></div>{open ? <div className="inline-form-grid"><label>{t("日文主名称")}<input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : t("创建")}</button></div></div> : null}</section>;
}

export function PersonEditor({ repository, person, onSaved, onDeleted, setMessage }: { repository: TauriLibraryRepository; person: Person; onSaved: () => void; onDeleted: () => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(getPreferredPersonName(person, "ja"));
  const [status, setStatus] = useState<PersonActivityStatus>(person.activityStatus);
  const [birthDate, setBirthDate] = useState(person.birthDate?.value ?? "");
  const [height, setHeight] = useState(person.heightCm ? String(person.heightCm) : "");
  const [biography, setBiography] = useState(localizeText(person.biographies, "zh-CN", ""));

  useEffect(() => { void repository.isPrivateEntity("people", person.id).then(setIsPrivate).catch((error) => setMessage(t("无法判断 Person 来源：{error}", { error: message(error) }))); }, [repository, person.id, setMessage, t]);

  async function save(): Promise<void> {
    if (!name.trim()) { setMessage(t("Person 主名称不能为空。")); return; }
    setBusy(true);
    try {
      const names = [...person.names];
      const primaryIndex = names.findIndex((item) => item.language === "ja" && item.type === "primary");
      if (primaryIndex >= 0) names[primaryIndex] = { ...names[primaryIndex], value: name.trim() };
      else names.unshift({ language: "ja", value: name.trim(), type: "primary" });
      const next: Person = {
        ...person,
        names,
        activityStatus: status,
        ...(birthDate.trim() ? { birthDate: { value: birthDate.trim(), precision: datePrecision(birthDate.trim()) } } : {}),
        ...(height.trim() && Number(height) > 0 ? { heightCm: Number(height) } : {}),
        ...(biography.trim() ? { biographies: { ...person.biographies, "zh-CN": biography.trim() } } : {}),
        updatedAt: new Date().toISOString(),
      };
      if (!birthDate.trim()) delete next.birthDate;
      if (!(height.trim() && Number(height) > 0)) delete next.heightCm;
      if (!biography.trim()) delete next.biographies;
      await repository.savePerson(next);
      setIsPrivate(true);
      setMessage(isPrivate ? t("已更新 Person：{name}。", { name: name.trim() }) : t("已为 Shared Person {name} 创建 Private Override。", { name: name.trim() }));
      onSaved();
    } catch (error) { setMessage(t("保存 Person 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  async function remove(): Promise<void> {
    if (!isPrivate || !window.confirm(t("删除 Private Person {name}？", { name: getPreferredPersonName(person, metadataLanguage) }))) return;
    setBusy(true);
    try { await repository.deletePrivatePerson(person.id); setMessage(t("已删除 Private Person。")); onDeleted(); }
    catch (error) { setMessage(t("删除 Person 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">DESKTOP EDIT</span><h2>{t("编辑人物")}</h2><p className="muted">{isPrivate ? t("Private Person 可直接修改。") : t("Shared Person 保存时会创建 Private Override。")}</p></div><div className="button-row"><button onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("编辑")}</button>{isPrivate ? <button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("删除 Private Person")}</button> : null}</div></div>{open ? <div className="editor-grid"><label>{t("日文主名称")}<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>{t("状态")}<select value={status} onChange={(event) => setStatus(event.target.value as PersonActivityStatus)}>{["active", "retired", "hiatus", "inactive", "unknown"].map((item) => <option key={item} value={item}>{activityStatusLabel(item as PersonActivityStatus, t)}</option>)}</select></label><label>{t("出生日期")}<input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label><label>{t("身高（cm）")}<input type="number" min="1" value={height} onChange={(event) => setHeight(event.target.value)} /></label><label className="span-2">{t("中文简介")}<textarea rows={4} value={biography} onChange={(event) => setBiography(event.target.value)} /></label><div className="span-2 form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : isPrivate ? t("保存修改") : t("保存为 Private Override")}</button></div></div> : null}</section>;
}

export function MediaBindingPanel({ media, repository, onChanged, setMessage }: { media: MediaFile; repository: TauriLibraryRepository; onChanged: () => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<Work[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    const inferred = inferCatalogFilenameMetadata(media.fileName).code;
    const initial = inferred ?? "";
    setQuery(initial);
    void repository.listWorks({ ...(initial ? { text: initial } : {}), page: 1, pageSize: 30, sort: "release_desc" }).then((result) => { if (!disposed) setWorks(result.items); });
    return () => { disposed = true; };
  }, [media.id, media.fileName, repository]);

  async function search(): Promise<void> {
    setBusy(true);
    try {
      const result = await repository.listWorks({ ...(query.trim() ? { text: query.trim() } : {}), page: 1, pageSize: 50, sort: "release_desc" });
      setWorks(result.items);
    } catch (error) { setMessage(t("查询 Work 候选失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  async function bind(nextWorkId: string | null): Promise<void> {
    setBusy(true);
    const before = media.workId;
    try {
      if (nextWorkId) {
        const target = await repository.findWorkById(nextWorkId);
        if (!target) throw new Error(t("目标 Work 不存在。"));
      }
      const updated: MediaFile = { ...media, updatedAt: new Date().toISOString() };
      if (nextWorkId) { updated.workId = nextWorkId; updated.matchMethod = "manual"; }
      else { delete updated.workId; delete updated.matchMethod; }
      await repository.saveMediaFile(updated);
      try {
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
        await repository.saveMediaFile(media);
        throw new Error(t("绑定审计 Receipt 写入失败，已回滚 MediaFile：{error}", { error: message(error) }));
      }
      setMessage(nextWorkId ? t("已保存人工 Work 绑定，并记录 Media Binding Receipt。") : t("已解除 Work 绑定，并记录 Media Binding Receipt。"));
      onChanged();
    } catch (error) { setMessage(t("媒体绑定失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  return <section className="settings-card binding-panel"><div className="section-heading"><div><span className="eyebrow">MANUAL MEDIA RESOLUTION</span><h2>{t("人工绑定")}：{media.fileName}</h2><p className="muted">{t("自动扫描只做保守番号匹配。这里可以搜索、绑定、重新绑定或解除，并写入 Private 审计 Receipt。")}</p></div>{media.workId ? <button className="danger-button" disabled={busy} onClick={() => void bind(null)}>{t("解除绑定")}</button> : null}</div><div className="binding-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索番号或标题")} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} /><button disabled={busy} onClick={() => void search()}>{busy ? t("查询中…") : t("搜索")}</button></div><div className="candidate-list">{works.map((work) => <article className="candidate-card" key={work.id}><div><strong>{work.code}</strong><p>{localizeText(work.titles, metadataLanguage)}</p><small>{work.id}</small></div><button className="primary-button" disabled={busy || media.workId === work.id} onClick={() => void bind(work.id)}>{media.workId === work.id ? t("当前绑定") : media.workId ? t("重新绑定") : t("绑定")}</button></article>)}{!works.length ? <p className="muted">{t("没有候选。尝试输入番号或标题。")} </p> : null}</div></section>;
}

function MultiSelect({ label, options, values, onChange }: { label: string; options: Array<{ id: string; label: string }>; values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useDesktopI18n();
  return <label>{label}<select multiple size={Math.min(7, Math.max(3, options.length))} value={values} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange([...event.currentTarget.selectedOptions].map((item) => item.value))}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><small className="muted">{t("Ctrl / Cmd 可多选")}</small></label>;
}

function activityStatusLabel(status: PersonActivityStatus, t: (source: string) => string): string {
  switch (status) {
    case "active": return t("活动中");
    case "retired": return t("已引退");
    case "hiatus": return t("暂停活动");
    case "inactive": return t("不活跃");
    case "unknown": return t("未知");
  }
}

function datePrecision(value: string): "year" | "month" | "day" {
  if (/^\d{4}$/.test(value)) return "year";
  if (/^\d{4}-\d{2}$/.test(value)) return "month";
  return "day";
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

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
