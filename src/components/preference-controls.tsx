"use client";

import { useRouter } from "next/navigation";

import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import type { UiDictionary } from "@/i18n/ui";
import type { ThemePreference } from "@/lib/preferences";

interface PreferenceControlsProps {
  uiLanguage: SupportedLanguage;
  metadataLanguage: SupportedLanguage;
  theme: ThemePreference;
  dictionary: UiDictionary;
}

/**
 * 这是本批代码里少数必须使用 Client Component 的组件。
 *
 * 原因：下拉框变化需要响应浏览器事件，并主动刷新当前页面。
 * 绝大多数资料读取页面仍保持 Server Component，避免把整个应用都变成客户端程序。
 */
export function PreferenceControls({
  uiLanguage,
  metadataLanguage,
  theme,
  dictionary,
}: PreferenceControlsProps) {
  const router = useRouter();

  function updatePreference(name: string, value: string) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="preference-controls" aria-label="Localogue preferences">
      <label className="preference-field">
        <span>{dictionary.uiLanguage}</span>
        <select
          value={uiLanguage}
          onChange={(event) =>
            updatePreference("localogue_ui_language", event.target.value)
          }
        >
          <option value="ja">日本語</option>
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </select>
      </label>

      <label className="preference-field">
        <span>{dictionary.metadataLanguage}</span>
        <select
          value={metadataLanguage}
          onChange={(event) =>
            updatePreference("localogue_metadata_language", event.target.value)
          }
        >
          <option value="ja">日本語</option>
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </select>
      </label>

      <label className="preference-field">
        <span>{dictionary.theme}</span>
        <select
          value={theme}
          onChange={(event) => {
            const value = event.target.value as ThemePreference;
            document.documentElement.dataset.theme = value;
            updatePreference("localogue_theme", value);
          }}
        >
          <option value="system">{dictionary.system}</option>
          <option value="light">{dictionary.light}</option>
          <option value="dark">{dictionary.dark}</option>
        </select>
      </label>
    </div>
  );
}
