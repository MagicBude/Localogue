import { cookies } from "next/headers";

import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

export type ThemePreference = "system" | "light" | "dark";

export interface UserPreferences {
  uiLanguage: SupportedLanguage;
  metadataLanguage: SupportedLanguage;
  theme: ThemePreference;
}

const languageSet = new Set<SupportedLanguage>(["ja", "zh-CN", "en"]);
const themeSet = new Set<ThemePreference>(["system", "light", "dark"]);

/**
 * V1 没有账号系统，因此偏好保存在浏览器 Cookie。
 *
 * Cookie 的优势是 Server Component 也能读取，从第一次服务器渲染开始就使用正确语言，
 * 避免页面先显示中文又瞬间跳成日文的闪烁。
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const cookieStore = await cookies();
  const uiLanguage = cookieStore.get("localogue_ui_language")?.value;
  const metadataLanguage = cookieStore.get("localogue_metadata_language")?.value;
  const theme = cookieStore.get("localogue_theme")?.value;

  return {
    // UI 默认中文，方便当前开发和学习。
    uiLanguage: isLanguage(uiLanguage) ? uiLanguage : "zh-CN",
    // 元数据默认优先显示日文原文，符合 Localogue 的产品原则。
    metadataLanguage: isLanguage(metadataLanguage) ? metadataLanguage : "ja",
    theme: isTheme(theme) ? theme : "system",
  };
}

function isLanguage(value: string | undefined): value is SupportedLanguage {
  return value !== undefined && languageSet.has(value as SupportedLanguage);
}

function isTheme(value: string | undefined): value is ThemePreference {
  return value !== undefined && themeSet.has(value as ThemePreference);
}
