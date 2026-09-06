import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { normalizeNfoCode } from "@/application/importers/nfo-filename-metadata";
import { WORK_TYPE_DEFINITIONS } from "@/application/importers/import-classification-normalizer";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import { localizeGenre } from "@/application/services/genre-localization-service";
import type { Organization } from "@/domain/entities/organization";
import type { Person, PersonActivityStatus, PersonName, PersonNameType } from "@/domain/entities/person";
import type { Work, WorkPersonRelation } from "@/domain/entities/work";
import type { LocalizedText } from "@/domain/value-objects/localized-text";

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
  const [titleJa, setTitleJa] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionJa, setDescriptionJa] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    const normalizedCode = normalizeNfoCode(code.trim()) ?? code.trim().toUpperCase();
    // Canonical Work 保存的是按语言分开的 LocalizedText。这里与编辑页共用相同的
    // 压缩规则，避免新建时先把中文塞进日文字段，之后还要靠用户手工纠正。
    const titles = compactLocalizedText({ ja: titleJa, "zh-CN": titleZh, en: titleEn });
    const descriptions = compactLocalizedText({ ja: descriptionJa, "zh-CN": descriptionZh, en: descriptionEn });
    if (!normalizedCode || !Object.keys(titles).length) {
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
      setBusy(false);
    }
  }

  return <section className="settings-card compact-management-card">
    <div className="section-heading">
      <div><span className="eyebrow">PRIVATE CRUD</span><h2>{t("新建作品")}</h2><p className="muted">{t("直接创建最小 Canonical Work；完整关系可进入详情页继续编辑。")}</p></div>
      <button className={open ? "ghost-button" : "primary-button"} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("+ 新建 Work")}</button>
    </div>
    {open ? <div className="editor-grid">
      <label>{t("番号")}<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MIDV-077" /></label>
      <label>{t("日文标题")}<input value={titleJa} onChange={(event) => setTitleJa(event.target.value)} placeholder={t("作品标题")} /></label>
      <label>{t("中文标题")}<input value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></label>
      <label>{t("英文标题")}<input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></label>
      <label>{t("日文简介")}<textarea value={descriptionJa} onChange={(event) => setDescriptionJa(event.target.value)} rows={4} /></label>
      <label>{t("中文简介")}<textarea value={descriptionZh} onChange={(event) => setDescriptionZh(event.target.value)} rows={4} /></label>
      <label className="span-2">{t("英文简介")}<textarea value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} rows={4} /></label>
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : t("创建")}</button></div>
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

  async function save(): Promise<void> {
    const normalizedCode = normalizeNfoCode(code.trim()) ?? code.trim().toUpperCase();
    const titles = compactLocalizedText({ ja: titleJa, "zh-CN": titleZh, en: titleEn });
    const descriptions = compactLocalizedText({ ja: descriptionJa, "zh-CN": descriptionZh, en: descriptionEn });
    if (!normalizedCode || !Object.keys(titles).length) {
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
        titles,
        ...(Object.keys(descriptions).length ? { descriptions } : {}),
        ...(releaseDate.trim() ? { releaseDate: { value: releaseDate.trim(), precision: datePrecision(releaseDate.trim()) } } : {}),
        ...(duration.trim() && Number(duration) > 0 ? { durationMinutes: Number(duration) } : {}),
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

  return <section className="settings-card compact-management-card">
    <div className="section-heading">
      <div><span className="eyebrow">DESKTOP EDIT</span><h2>{t("编辑作品")}</h2><p className="muted">{isPrivate ? t("当前实体来自 Private Library，可直接编辑。") : t("当前来自 Shared Pack；保存会建立同 ID 的 Private Override，不修改 Shared Pack。")}</p></div>
      <div className="button-row"><button onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("编辑")}</button>{isPrivate ? <button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("删除 Private Work")}</button> : null}</div>
    </div>
    {open ? <div className="editor-grid">
      <label>{t("番号")}<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label>{t("日文标题")}<input value={titleJa} onChange={(event) => setTitleJa(event.target.value)} /></label>
      <label>{t("中文标题")}<input value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></label>
      <label className="span-2">{t("英文标题")}<input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></label>
      <label>{t("日文简介")}<textarea value={descriptionJa} onChange={(event) => setDescriptionJa(event.target.value)} rows={4} /></label>
      <label>{t("中文简介")}<textarea value={descriptionZh} onChange={(event) => setDescriptionZh(event.target.value)} rows={4} /></label>
      <label className="span-2">{t("英文简介")}<textarea value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} rows={4} /></label>
      <label>{t("发行日期")}<input value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} placeholder="2026-09-03 / 2026-09 / 2026" /></label>
      <label>{t("时长（分钟）")}<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
      <label>{t("厂商")}<select value={makerId} onChange={(event) => setMakerId(event.target.value)}><option value="">{t("未设置")}</option>{makers.map((item) => <option key={item.id} value={item.id}>{localizeText(item.names, metadataLanguage, item.id)}</option>)}</select></label>
      <label>{t("厂牌")}<select value={labelId} onChange={(event) => setLabelId(event.target.value)}><option value="">{t("未设置")}</option>{labels.map((item) => <option key={item.id} value={item.id}>{localizeText(item.names, metadataLanguage, item.id)}</option>)}</select></label>
      <MultiSelect label={t("演员")} values={performerIds} onChange={setPerformerIds} options={people.map((item) => ({ id: item.id, label: getPreferredPersonName(item, metadataLanguage) }))} />
      <MultiSelect label={t("导演")} values={directorIds} onChange={setDirectorIds} options={people.map((item) => ({ id: item.id, label: getPreferredPersonName(item, metadataLanguage) }))} />
      <MultiSelect label={t("作品类型")} values={workTypeIds} onChange={setWorkTypeIds} options={WORK_TYPE_DEFINITIONS.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage, item.id) }))} />
      <MultiSelect label={t("系列")} values={seriesIds} onChange={setSeriesIds} options={seriesOptions} />
      <MultiSelect label={t("题材")} values={genreIds} onChange={setGenreIds} options={genreOptions} />
      <MultiSelect label={t("标签")} values={tagIds} onChange={setTagIds} options={tagOptions} />
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : isPrivate ? t("保存修改") : t("保存为 Private Override")}</button></div>
    </div> : null}
  </section>;
}

export function CreatePersonPanel({ repository, onSaved, setMessage }: { repository: TauriLibraryRepository; onSaved: (person: Person) => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [nameJa, setNameJa] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    if (!nameJa.trim()) { setMessage(t("新建 Person 需要姓名。")); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const person: Person = {
        schemaVersion: 1,
        id: `person_${crypto.randomUUID()}`,
        names: compactPersonDisplayNames(nameJa, nameZh, nameEn),
        activityStatus: "unknown",
        careerEvents: [],
        galleryAssetIds: [],
        createdAt: now,
        updatedAt: now,
      };
      await repository.savePerson(person);
      setNameJa(""); setNameZh(""); setNameEn(""); setOpen(false);
      setMessage(t("已在 Private Library 新建 Person：{name}。", { name: getPreferredPersonName(person, metadataLanguage) }));
      onSaved(person);
    } catch (error) { setMessage(t("新建 Person 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  return <section className="settings-card compact-management-card"><div className="section-heading"><div><span className="eyebrow">PRIVATE CRUD</span><h2>{t("新建人物")}</h2></div><button className={open ? "ghost-button" : "primary-button"} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("+ 新建 Person")}</button></div>{open ? <div className="editor-grid"><label>{t("日文主名称")}<input value={nameJa} onChange={(event) => setNameJa(event.target.value)} /></label><label>{t("中文名称")}<input value={nameZh} onChange={(event) => setNameZh(event.target.value)} /></label><label>{t("英文名称")}<input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label><div className="form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : t("创建")}</button></div></div> : null}</section>;
}

export function PersonEditor({ repository, person, onSaved, onDeleted, setMessage }: { repository: TauriLibraryRepository; person: Person; onSaved: () => void; onDeleted: () => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameJa, setNameJa] = useState(findPersonDisplayName(person, "ja"));
  const [nameZh, setNameZh] = useState(findPersonDisplayName(person, "zh-CN"));
  const [nameEn, setNameEn] = useState(findPersonDisplayName(person, "en"));
  const [status, setStatus] = useState<PersonActivityStatus>(person.activityStatus);
  const [birthDate, setBirthDate] = useState(person.birthDate?.value ?? "");
  const [height, setHeight] = useState(person.heightCm ? String(person.heightCm) : "");
  const [biographyJa, setBiographyJa] = useState(person.biographies?.ja ?? "");
  const [biographyZh, setBiographyZh] = useState(person.biographies?.["zh-CN"] ?? "");
  const [biographyEn, setBiographyEn] = useState(person.biographies?.en ?? "");

  useEffect(() => { void repository.isPrivateEntity("people", person.id).then(setIsPrivate).catch((error) => setMessage(t("无法判断 Person 来源：{error}", { error: message(error) }))); }, [repository, person.id, setMessage, t]);

  async function save(): Promise<void> {
    if (!nameJa.trim()) { setMessage(t("Person 主名称不能为空。")); return; }
    setBusy(true);
    try {
      const names = mergePersonDisplayNames(person.names, nameJa, nameZh, nameEn);
      const biographies = compactLocalizedText({ ja: biographyJa, "zh-CN": biographyZh, en: biographyEn });
      const next: Person = {
        ...person,
        names,
        activityStatus: status,
        ...(birthDate.trim() ? { birthDate: { value: birthDate.trim(), precision: datePrecision(birthDate.trim()) } } : {}),
        ...(height.trim() && Number(height) > 0 ? { heightCm: Number(height) } : {}),
        ...(Object.keys(biographies).length ? { biographies } : {}),
        updatedAt: new Date().toISOString(),
      };
      if (!birthDate.trim()) delete next.birthDate;
      if (!(height.trim() && Number(height) > 0)) delete next.heightCm;
      if (!Object.keys(biographies).length) delete next.biographies;
      await repository.savePerson(next);
      setIsPrivate(true);
      setMessage(isPrivate ? t("已更新 Person：{name}。", { name: nameJa.trim() }) : t("已为 Shared Person {name} 创建 Private Override。", { name: nameJa.trim() }));
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

  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">DESKTOP EDIT</span><h2>{t("编辑人物")}</h2><p className="muted">{isPrivate ? t("Private Person 可直接修改。") : t("Shared Person 保存时会创建 Private Override。")}</p></div><div className="button-row"><button onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("编辑")}</button>{isPrivate ? <button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("删除 Private Person")}</button> : null}</div></div>{open ? <div className="editor-grid"><label>{t("日文主名称")}<input value={nameJa} onChange={(event) => setNameJa(event.target.value)} /></label><label>{t("中文名称")}<input value={nameZh} onChange={(event) => setNameZh(event.target.value)} /></label><label>{t("英文名称")}<input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label><label>{t("状态")}<select value={status} onChange={(event) => setStatus(event.target.value as PersonActivityStatus)}>{["active", "retired", "hiatus", "inactive", "unknown"].map((item) => <option key={item} value={item}>{activityStatusLabel(item as PersonActivityStatus, t)}</option>)}</select></label><label>{t("出生日期")}<input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label><label>{t("身高（cm）")}<input type="number" min="1" value={height} onChange={(event) => setHeight(event.target.value)} /></label><label>{t("日文简介")}<textarea rows={4} value={biographyJa} onChange={(event) => setBiographyJa(event.target.value)} /></label><label>{t("中文简介")}<textarea rows={4} value={biographyZh} onChange={(event) => setBiographyZh(event.target.value)} /></label><label className="span-2">{t("英文简介")}<textarea rows={4} value={biographyEn} onChange={(event) => setBiographyEn(event.target.value)} /></label><div className="span-2 form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? t("保存中…") : isPrivate ? t("保存修改") : t("保存为 Private Override")}</button></div></div> : null}</section>;
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

/** 空输入不写入 JSON，避免语言切换把空字符串误当成有效翻译。 */
function compactLocalizedText(value: Record<"ja" | "zh-CN" | "en", string>): LocalizedText {
  return Object.fromEntries(Object.entries(value).map(([language, text]) => [language, text.trim()]).filter(([, text]) => text)) as LocalizedText;
}

/**
 * 返回人物在某种语言下用于界面展示的名称。
 *
 * Person.names 还可能保存旧艺名、别名等历史事实，因此这里仅挑选 primary、
 * localized 或 romanized 名称，绝不能把数组中碰巧排在前面的 alias 当成可编辑主名称。
 */
function findPersonDisplayName(person: Person, language: "ja" | "zh-CN" | "en"): string {
  const preferredTypes: PersonNameType[] = language === "en" ? ["primary", "romanized", "localized"] : ["primary", "localized"];
  for (const type of preferredTypes) {
    const match = person.names.find((item) => item.language === language && item.type === type);
    if (match) return match.value;
  }
  return "";
}

/** 将新建表单的三语显示名转换成明确的 Domain 语义，空译名不会进入 JSON。 */
function compactPersonDisplayNames(nameJa: string, nameZh: string, nameEn: string): PersonName[] {
  return [
    { language: "ja", value: nameJa.trim(), type: "primary" },
    ...(nameZh.trim() ? [{ language: "zh-CN" as const, value: nameZh.trim(), type: "localized" as const }] : []),
    ...(nameEn.trim() ? [{ language: "en" as const, value: nameEn.trim(), type: "romanized" as const }] : []),
  ];
}

/**
 * 更新界面负责的三种显示名，同时保留 alias、former_name、stage_name 等历史名称。
 * 这样编辑一次译名不会误删人物匹配和审计仍需使用的别名证据。
 */
function mergePersonDisplayNames(existing: PersonName[], nameJa: string, nameZh: string, nameEn: string): PersonName[] {
  const editable = (item: PersonName): boolean =>
    (item.language === "ja" && item.type === "primary")
    || (item.language === "zh-CN" && (item.type === "primary" || item.type === "localized"))
    || (item.language === "en" && (item.type === "primary" || item.type === "localized" || item.type === "romanized"));
  return [...compactPersonDisplayNames(nameJa, nameZh, nameEn), ...existing.filter((item) => !editable(item))];
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
