"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { CareerEvent, Person, PersonName } from "@/domain/entities/person";

type Language = "ja" | "zh-CN" | "en";

interface PersonEditFormProps {
  person: Person;
  writable: boolean;
  uiLanguage: Language;
}

const text = {
  ja: {
    save: "保存",
    saving: "保存中…",
    readonly: "現在は Demo 読み取り専用モードです。LOCALOGUE_LIBRARY_PATH を設定すると人物資料を編集できます。",
    saved: "人物資料を保存しました。",
    failed: "保存に失敗しました。入力内容を確認してください。",
    names: "名前・別名",
    addName: "名前を追加",
    remove: "削除",
    status: "活動状態",
    birth: "生年月日",
    birthPlace: "出身地",
    body: "身体情報",
    biography: "プロフィール",
    career: "活動履歴",
    addEvent: "イベントを追加",
    portrait: "ポートレート Asset ID",
    gallery: "Gallery Asset IDs（1行1件）",
    dateHelp: "日付は YYYY / YYYY-MM / YYYY-MM-DD のいずれか。",
  },
  "zh-CN": {
    save: "保存人物资料",
    saving: "保存中…",
    readonly: "当前是 Demo 只读模式。配置 LOCALOGUE_LIBRARY_PATH 后才能编辑人物资料。",
    saved: "人物资料已保存。",
    failed: "保存失败，请检查输入内容。",
    names: "姓名与别名",
    addName: "添加姓名",
    remove: "删除",
    status: "活动状态",
    birth: "出生日期",
    birthPlace: "出生地",
    body: "身体资料",
    biography: "个人简介",
    career: "职业事件",
    addEvent: "添加职业事件",
    portrait: "人物头像 Asset ID",
    gallery: "图集 Asset IDs（每行一个）",
    dateHelp: "日期允许 YYYY / YYYY-MM / YYYY-MM-DD，可保留真实精度。",
  },
  en: {
    save: "Save person",
    saving: "Saving…",
    readonly: "The demo library is read-only. Configure LOCALOGUE_LIBRARY_PATH to edit person metadata.",
    saved: "Person metadata saved.",
    failed: "Save failed. Check the entered values.",
    names: "Names and aliases",
    addName: "Add name",
    remove: "Remove",
    status: "Activity status",
    birth: "Birth date",
    birthPlace: "Birth place",
    body: "Body measurements",
    biography: "Biography",
    career: "Career events",
    addEvent: "Add career event",
    portrait: "Portrait Asset ID",
    gallery: "Gallery Asset IDs (one per line)",
    dateHelp: "Dates accept YYYY / YYYY-MM / YYYY-MM-DD to preserve real precision.",
  },
} as const;

const nameTypes = ["primary", "localized", "romanized", "alias", "former_name", "stage_name", "alternate"] as const;
const eventTypes = ["debut", "retirement", "return", "hiatus_start", "hiatus_end", "name_change", "other"] as const;
const statuses = ["active", "retired", "hiatus", "inactive", "unknown"] as const;

/**
 * 这里故意使用受控 React 表单，而不是把整个 Person JSON 暴露给用户直接改。
 * 这样可以学习“UI 状态 → API DTO → Domain 校验 → Repository”这一条典型 Web 写入链路。
 */
export function PersonEditForm({ person, writable, uiLanguage }: PersonEditFormProps) {
  const router = useRouter();
  const t = text[uiLanguage];
  const [names, setNames] = useState<PersonName[]>(person.names);
  const [careerEvents, setCareerEvents] = useState<CareerEvent[]>(person.careerEvents);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!writable) return;
    const form = new FormData(event.currentTarget);
    const numberOrEmpty = (key: string) => {
      const value = String(form.get(key) ?? "").trim();
      return value ? Number(value) : undefined;
    };
    const value = (key: string) => String(form.get(key) ?? "").trim() || undefined;

    const body = {
      activityStatus: value("activityStatus"),
      names,
      careerEvents,
      birthDate: value("birthDate"),
      birthPlace: { ja: value("birthPlaceJa"), "zh-CN": value("birthPlaceZh"), en: value("birthPlaceEn") },
      heightCm: numberOrEmpty("heightCm"),
      measurements: {
        bustCm: numberOrEmpty("bustCm"),
        waistCm: numberOrEmpty("waistCm"),
        hipCm: numberOrEmpty("hipCm"),
        cup: value("cup"),
      },
      biographies: { ja: value("biographyJa"), "zh-CN": value("biographyZh"), en: value("biographyEn") },
      portraitAssetId: value("portraitAssetId"),
      galleryAssetIds: String(form.get("galleryAssetIds") ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    };

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/people/${encodeURIComponent(person.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      setMessage(t.saved);
      router.refresh();
    } catch {
      setMessage(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="person-edit-form" onSubmit={(event) => void submit(event)}>
      {!writable ? <div className="readonly-banner">{t.readonly}</div> : null}

      <section className="person-edit-section">
        <div className="section-heading"><h2>{t.names}</h2></div>
        <div className="editable-list">
          {names.map((name, index) => (
            <div className="editable-row editable-row--name" key={`${index}-${name.type}-${name.language}`}>
              <select disabled={!writable} value={name.type} onChange={(event) => setNames((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as PersonName["type"] } : item))}>
                {nameTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select disabled={!writable} value={name.language} onChange={(event) => setNames((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, language: event.target.value as PersonName["language"] } : item))}>
                <option value="ja">日本語</option><option value="zh-CN">简体中文</option><option value="en">English</option>
              </select>
              <input disabled={!writable} value={name.value} onChange={(event) => setNames((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
              <input disabled={!writable} placeholder="validFrom" value={name.validFrom ?? ""} onChange={(event) => setNames((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, validFrom: event.target.value || undefined } : item))} />
              <input disabled={!writable} placeholder="validTo" value={name.validTo ?? ""} onChange={(event) => setNames((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, validTo: event.target.value || undefined } : item))} />
              <button className="text-button" disabled={!writable} onClick={() => setNames((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button">{t.remove}</button>
            </div>
          ))}
        </div>
        <button className="secondary-button" disabled={!writable} onClick={() => setNames((items) => [...items, { type: "alias", language: "ja", value: "" }])} type="button">+ {t.addName}</button>
      </section>

      <section className="person-edit-section person-edit-grid">
        <label className="field"><span>{t.status}</span><select defaultValue={person.activityStatus} disabled={!writable} name="activityStatus">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="field"><span>{t.birth}</span><input defaultValue={person.birthDate?.value ?? ""} disabled={!writable} name="birthDate" placeholder="2000-01-31" /><small>{t.dateHelp}</small></label>
        <label className="field"><span>{t.portrait}</span><input defaultValue={person.portraitAssetId ?? ""} disabled={!writable} name="portraitAssetId" /></label>
        <label className="field field--wide"><span>{t.gallery}</span><textarea defaultValue={person.galleryAssetIds.join("\n")} disabled={!writable} name="galleryAssetIds" rows={4} /></label>
      </section>

      <section className="person-edit-section">
        <h2>{t.birthPlace}</h2>
        <div className="language-field-grid">
          <LocalizedField defaultValue={person.birthPlace?.ja} disabled={!writable} label="日本語" name="birthPlaceJa" />
          <LocalizedField defaultValue={person.birthPlace?.["zh-CN"]} disabled={!writable} label="简体中文" name="birthPlaceZh" />
          <LocalizedField defaultValue={person.birthPlace?.en} disabled={!writable} label="English" name="birthPlaceEn" />
        </div>
      </section>

      <section className="person-edit-section">
        <h2>{t.body}</h2>
        <div className="person-edit-grid person-edit-grid--measurements">
          <NumberField defaultValue={person.heightCm} disabled={!writable} label="Height (cm)" name="heightCm" />
          <NumberField defaultValue={person.measurements?.bustCm} disabled={!writable} label="Bust" name="bustCm" />
          <NumberField defaultValue={person.measurements?.waistCm} disabled={!writable} label="Waist" name="waistCm" />
          <NumberField defaultValue={person.measurements?.hipCm} disabled={!writable} label="Hip" name="hipCm" />
          <LocalizedField defaultValue={person.measurements?.cup} disabled={!writable} label="Cup" name="cup" />
        </div>
      </section>

      <section className="person-edit-section">
        <h2>{t.biography}</h2>
        <div className="language-field-grid">
          <TextArea defaultValue={person.biographies?.ja} disabled={!writable} label="日本語" name="biographyJa" />
          <TextArea defaultValue={person.biographies?.["zh-CN"]} disabled={!writable} label="简体中文" name="biographyZh" />
          <TextArea defaultValue={person.biographies?.en} disabled={!writable} label="English" name="biographyEn" />
        </div>
      </section>

      <section className="person-edit-section">
        <div className="section-heading"><h2>{t.career}</h2></div>
        <div className="editable-list">
          {careerEvents.map((careerEvent, index) => (
            <div className="editable-row editable-row--career" key={`${index}-${careerEvent.type}`}>
              <select disabled={!writable} value={careerEvent.type} onChange={(event) => setCareerEvents((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as CareerEvent["type"] } : item))}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select>
              <input disabled={!writable} placeholder="YYYY-MM-DD" value={careerEvent.date?.value ?? ""} onChange={(event) => setCareerEvents((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, date: event.target.value ? { value: event.target.value, precision: inferPrecision(event.target.value) } : undefined } : item))} />
              <input disabled={!writable} placeholder="note" value={careerEvent.note ?? ""} onChange={(event) => setCareerEvents((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value || undefined } : item))} />
              <button className="text-button" disabled={!writable} onClick={() => setCareerEvents((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button">{t.remove}</button>
            </div>
          ))}
        </div>
        <button className="secondary-button" disabled={!writable} onClick={() => setCareerEvents((items) => [...items, { type: "other" }])} type="button">+ {t.addEvent}</button>
      </section>

      <div className="person-edit-actions">
        <button className="primary-button" disabled={!writable || busy} type="submit">{busy ? t.saving : t.save}</button>
        {message ? <span className="muted">{message}</span> : null}
      </div>
    </form>
  );
}

function LocalizedField({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue?: string; disabled: boolean }) {
  return <label className="field"><span>{label}</span><input defaultValue={defaultValue ?? ""} disabled={disabled} name={name} /></label>;
}
function NumberField({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue?: number; disabled: boolean }) {
  return <label className="field"><span>{label}</span><input defaultValue={defaultValue ?? ""} disabled={disabled} min="0" name={name} type="number" /></label>;
}
function TextArea({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue?: string; disabled: boolean }) {
  return <label className="field"><span>{label}</span><textarea defaultValue={defaultValue ?? ""} disabled={disabled} name={name} rows={7} /></label>;
}
function inferPrecision(value: string): "year" | "month" | "day" {
  return value.length <= 4 ? "year" : value.length <= 7 ? "month" : "day";
}
