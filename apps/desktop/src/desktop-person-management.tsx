import { useEffect, useState } from "react";

import { getPreferredPersonName } from "@/application/services/localization-service";
import type { Person, PersonActivityStatus, PersonName, PersonNameType } from "@/domain/entities/person";

import { useDesktopI18n } from "./desktop-i18n";
import { compactLocalizedText, datePrecision, message } from "./desktop-management-utils";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";

/** Desktop Person 的新建与编辑表单；名称类型在本模块内保持明确语义。 */
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
  const editable = (item: PersonName): boolean =>
    (item.language === "ja" && item.type === "primary")
    || (item.language === "zh-CN" && (item.type === "primary" || item.type === "localized"))
    || (item.language === "en" && (item.type === "primary" || item.type === "localized" || item.type === "romanized"));
  return [...compactPersonDisplayNames(nameJa, nameZh, nameEn), ...existing.filter((item) => !editable(item))];
}
