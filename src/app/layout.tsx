import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { getUiDictionary } from "@/i18n/ui";
import { getUserPreferences } from "@/lib/preferences";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Localogue",
    template: "%s · Localogue",
  },
  description: "本地优先、资料库优先的个人媒体收藏与元数据管理系统。",
};

/**
 * Root Layout 是所有页面共享的最外层结构。
 *
 * 这里统一读取语言/主题偏好并渲染导航，避免每个页面重复做相同工作。
 * Next.js App Router 中，layout.tsx 会包裹其目录下的所有 page.tsx。
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);

  return (
    <html
      data-theme={preferences.theme}
      lang={preferences.uiLanguage}
      suppressHydrationWarning
    >
      <body>
        <SiteHeader dictionary={dictionary} preferences={preferences} />
        <main className="page-shell">{children}</main>
      </body>
    </html>
  );
}
