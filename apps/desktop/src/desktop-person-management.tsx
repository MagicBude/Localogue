import { useEffect, useRef, useState } from "react";

import { getPreferredPersonName } from "@/application/services/localization-service";
import type { Person, PersonActivityStatus, PersonName, PersonNameType } from "@/domain/entities/person";

import { useDesktopI18n } from "./desktop-i18n";
import { compactLocalizedText, datePrecision, isPositiveInteger, isValidPartialDate, message } from "./desktop-management-utils";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useUiConfirm } from "./ui/confirm-dialog";

/** Desktop Person 的新建与编辑表单；名称类型在本模块内保持明确语义。 */
export function CreatePersonPanel({ repository, onSaved, setMessage }: { repository: TauriLibraryRepository; onSaved: (person: Person) => void; setMessage: (message: string) => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [nameJa, setNameJa] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);
  const operationPending = useRef(false);

  async function save(): Promise<void> {
    if (operationPending.current) return;
    if (!nameJa.trim()) { setMessage(t("新建 Person 需要姓名。")); return; }
    operationPending.current = true;
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
    finally { operationPending.current = false; setBusy(false); }
  }

  return <section className="settings-card compact-management-card"><div className="section-heading"><div><span className="eyebrow">PRIVATE CRUD</span><h2>{t("新建人物")}</h2></div><button className={open ? "ghost-button" : "primary-button"} disabled={busy} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("+ 新建 Person")}</button></div>{open ? <fieldset className="editor-grid" disabled={busy}><label>{t("日文主名称")}<input value={nameJa} onChange={(event) => setNameJa(event.target.value)} /></label><label>{t("中文名称")}<input value={nameZh} onChange={(event) => setNameZh(event.target.value)} /></label><label>{t("英文名称")}<input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label><div className="form-actions"><button className="primary-button" onClick={() => void save()}>{busy ? t("保存中…") : t("创建")}</button></div></fieldset> : null}</section>;
}

/** 取消会重新建立编辑会话，丢弃这次尚未保存的字段，同时不触碰磁盘。 */
export function PersonEditor(props: { repository: TauriLibraryRepository; person: Person; onSaved: () => void; onDeleted: () => void; setMessage: (message: string) => void }) {
  const [session, setSession] = useState(0);
  return <PersonEditorSession key={session} {...props} onCancel={() => setSession((value) => value + 1)} />;
}

function PersonEditorSession({ repository, person, onSaved, onDeleted, setMessage, onCancel }: { repository: TauriLibraryRepository; person: Person; onSaved: () => void; onDeleted: () => void; setMessage: (message: string) => void; onCancel: () => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  const confirm = useUiConfirm();
  const [open, setOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const operationPending = useRef(false);
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
    if (operationPending.current) return;
    if (!nameJa.trim()) { setMessage(t("Person 主名称不能为空。")); return; }
    if (birthDate.trim() && !isValidPartialDate(birthDate.trim())) {
      setMessage(t("出生日期必须是有效的 YYYY、YYYY-MM 或 YYYY-MM-DD。"));
      return;
    }
    if (height.trim() && !isPositiveInteger(height.trim())) {
      setMessage(t("身高必须是大于 0 的整数厘米。"));
      return;
    }
    operationPending.current = true;
    setBusy(true);
    try {
      const names = mergePersonDisplayNames(person.names, nameJa, nameZh, nameEn);
      const biographies = compactLocalizedText({ ja: biographyJa, "zh-CN": biographyZh, en: biographyEn });
      const next: Person = {
        ...person,
        names,
        activityStatus: status,
        ...(birthDate.trim() ? { birthDate: { value: birthDate.trim(), precision: datePrecision(birthDate.trim()) } } : {}),
        ...(height.trim() ? { heightCm: Number(height) } : {}),
        ...(Object.keys(biographies).length ? { biographies } : {}),
        updatedAt: new Date().toISOString(),
      };
      if (!birthDate.trim()) delete next.birthDate;
      if (!height.trim()) delete next.heightCm;
      if (!Object.keys(biographies).length) delete next.biographies;
      await repository.savePerson(next);
      setIsPrivate(true);
      setMessage(isPrivate ? t("已更新 Person：{name}。", { name: nameJa.trim() }) : t("已为 Shared Person {name} 创建 Private Override。", { name: nameJa.trim() }));
      onSaved();
    } catch (error) { setMessage(t("保存 Person 失败：{error}", { error: message(error) })); }
    finally { operationPending.current = false; setBusy(false); }
  }

  async function remove(): Promise<void> {
    if (operationPending.current) return;
    if (!isPrivate || !await confirm({ title: t("确认"), description: t("删除 Private Person {name}？", { name: getPreferredPersonName(person, metadataLanguage) }), confirmLabel: t("删除"), dangerous: true })) return;
    operationPending.current = true;
    setBusy(true);
    try { await repository.deletePrivatePerson(person.id); setMessage(t("已删除 Private Person。")); onDeleted(); }
    catch (error) { setMessage(t("删除 Person 失败：{error}", { error: message(error) })); }
    finally { operationPending.current = false; setBusy(false); }
  }

  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">DESKTOP EDIT</span><h2>{t("编辑人物")}</h2><p className="muted">{isPrivate ? t("Private Person 可直接修改。") : t("Shared Person 保存时会创建 Private Override。")}</p></div><div className="button-row"><button disabled={busy} onClick={() => setOpen((value) => !value)}>{open ? t("收起") : t("编辑")}</button>{isPrivate ? <button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("删除 Private Person")}</button> : null}</div></div>{open ? <fieldset className="editor-grid" disabled={busy}><label>{t("日文主名称")}<input value={nameJa} onChange={(event) => setNameJa(event.target.value)} /></label><label>{t("中文名称")}<input value={nameZh} onChange={(event) => setNameZh(event.target.value)} /></label><label>{t("英文名称")}<input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label><label>{t("状态")}<select value={status} onChange={(event) => setStatus(event.target.value as PersonActivityStatus)}>{["active", "retired", "hiatus", "inactive", "unknown"].map((item) => <option key={item} value={item}>{activityStatusLabel(item as PersonActivityStatus, t)}</option>)}</select></label><label>{t("出生日期")}<input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label><label>{t("身高（cm）")}<input type="number" min="1" value={height} onChange={(event) => setHeight(event.target.value)} /></label><label>{t("日文简介")}<textarea rows={4} value={biographyJa} onChange={(event) => setBiographyJa(event.target.value)} /></label><label>{t("中文简介")}<textarea rows={4} value={biographyZh} onChange={(event) => setBiographyZh(event.target.value)} /></label><label className="span-2">{t("英文简介")}<textarea rows={4} value={biographyEn} onChange={(event) => setBiographyEn(event.target.value)} /></label><div className="span-2 form-actions"><button onClick={onCancel}>{t("取消")}</button><button className="primary-button" onClick={() => void save()}>{busy ? t("保存中…") : isPrivate ? t("保存修改") : t("保存为 Private Override")}</button></div></fieldset> : null}</section>;
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
  const next = [...existing];

  /**
   * 表单展示的是按优先级找到的第一条名称，所以保存时也只更新同一条。
   * 若把同语言、同类型的所有项先过滤掉，多种合法罗马字拼写也会一起丢失。
   */
  const updateOne = (language: "ja" | "zh-CN" | "en", types: PersonNameType[], value: string, fallbackType: PersonNameType): void => {
    const index = types
      .map((type) => next.findIndex((item) => item.language === language && item.type === type))
      .find((candidate) => candidate >= 0) ?? -1;
    const normalized = value.trim();
    if (index >= 0 && normalized) next[index] = { ...next[index], value: normalized };
    else if (index >= 0) next.splice(index, 1);
    else if (normalized) next.push({ language, value: normalized, type: fallbackType });
  };

  updateOne("ja", ["primary"], nameJa, "primary");
  updateOne("zh-CN", ["primary", "localized"], nameZh, "localized");
  updateOne("en", ["primary", "romanized", "localized"], nameEn, "romanized");
  return next;
}
