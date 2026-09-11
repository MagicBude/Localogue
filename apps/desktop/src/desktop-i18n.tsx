import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getUiDictionary, type UiDictionary } from "@/i18n/ui";
import {
  desktopAssetLabels,
  desktopSupplementalTranslations,
  desktopTranslations,
} from "./desktop-i18n-translations";

const UI_LANGUAGE_KEY = "localogue_ui_language";
const METADATA_LANGUAGE_KEY = "localogue_metadata_language";
const languageSet = new Set<SupportedLanguage>(["ja", "zh-CN", "en"]);

type Interpolation = Record<string, string | number>;

interface DesktopI18nValue {
  uiLanguage: SupportedLanguage;
  metadataLanguage: SupportedLanguage;
  ui: UiDictionary;
  setUiLanguage: (language: SupportedLanguage) => void;
  setMetadataLanguage: (language: SupportedLanguage) => void;
  t: (source: string, values?: Interpolation) => string;
  assetTypeLabel: (type: string) => string;
}

const DesktopI18nContext = createContext<DesktopI18nValue | null>(null);

export function DesktopI18nProvider({ children }: { children: ReactNode }) {
  const [uiLanguage, setUiLanguageState] = useState<SupportedLanguage>(() => readLanguage(UI_LANGUAGE_KEY, "zh-CN"));
  const [metadataLanguage, setMetadataLanguageState] = useState<SupportedLanguage>(() => readLanguage(METADATA_LANGUAGE_KEY, "ja"));

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  const value = useMemo<DesktopI18nValue>(() => {
    const ui = getUiDictionary(uiLanguage);
    const t = (source: string, values?: Interpolation) => {
      const translated = uiLanguage === "zh-CN"
        ? source
        : uiLanguage === "ja"
          ? desktopSupplementalTranslations.ja[source] ?? desktopTranslations.ja[source] ?? source
          : desktopSupplementalTranslations.en[source] ?? desktopTranslations.en[source] ?? source;
      return interpolate(translated, values);
    };
    return {
      uiLanguage,
      metadataLanguage,
      ui,
      setUiLanguage(language) {
        setUiLanguageState(language);
        window.localStorage.setItem(UI_LANGUAGE_KEY, language);
      },
      setMetadataLanguage(language) {
        setMetadataLanguageState(language);
        window.localStorage.setItem(METADATA_LANGUAGE_KEY, language);
      },
      t,
      assetTypeLabel(type) {
        const labels = uiLanguage === "ja" ? desktopAssetLabels.ja : uiLanguage === "en" ? desktopAssetLabels.en : desktopAssetLabels["zh-CN"];
        return labels[type] ?? t("其他");
      },
    };
  }, [uiLanguage, metadataLanguage]);

  return <DesktopI18nContext.Provider value={value}>{children}</DesktopI18nContext.Provider>;
}
export function useDesktopI18n(): DesktopI18nValue {
  const value = useContext(DesktopI18nContext);
  if (!value) throw new Error("useDesktopI18n must be used inside DesktopI18nProvider");
  return value;
}

export function DesktopLanguageControls({ compact = false }: { compact?: boolean }) {
  const { uiLanguage, metadataLanguage, setUiLanguage, setMetadataLanguage, t } = useDesktopI18n();
  const uiSelect = <select value={uiLanguage} onChange={(event) => {
    const language = event.target.value as SupportedLanguage;
    setUiLanguage(language);
    setMetadataLanguage(language);
  }}><option value="zh-CN">简体中文</option><option value="ja">日本語</option><option value="en">English</option></select>;
  const metadataSelect = <select value={metadataLanguage} onChange={(event) => setMetadataLanguage(event.target.value as SupportedLanguage)}><option value="ja">日本語</option><option value="zh-CN">简体中文</option><option value="en">English</option></select>;

  if (compact) return (
    <details className="desktop-language-menu">
      <summary>{t("语言")}</summary>
      <div className="desktop-language-menu__panel">
        <label><span>{t("语言（界面 + 元数据）")}</span>{uiSelect}</label>
        <label title={t("优先显示所选语言；实体没有对应翻译时保留来源原文。")}><span>{t("元数据语言（高级）")}</span>{metadataSelect}</label>
      </div>
    </details>
  );
  return (
    <div className="desktop-language-controls" aria-label="Localogue language preferences">
      <label>
        <span>{t("语言（界面 + 元数据）")}</span>
        {uiSelect}
      </label>
      <label title={t("优先显示所选语言；实体没有对应翻译时保留来源原文。")}>
        <span>{t("元数据语言（高级）")}</span>
        {metadataSelect}
      </label>
    </div>
  );
}

function readLanguage(key: string, fallback: SupportedLanguage): SupportedLanguage {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value && languageSet.has(value as SupportedLanguage) ? value as SupportedLanguage : fallback;
}

function interpolate(value: string, values?: Interpolation): string {
  if (!values) return value;
  return value.replace(/\{([^}]+)\}/g, (match, key: string) => key in values ? String(values[key]) : match);
}
