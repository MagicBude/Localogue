import { useState } from "react";
import { BookInformation20Regular, Info20Regular } from "@fluentui/react-icons";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { useDesktopI18n } from "./desktop-i18n";
import { UiActionDialog } from "./ui/action-dialog";
import { UiButton } from "./ui/button";
import { SettingsRow } from "./ui/settings-row";

/** 随安装包提供离线教程；使用界面语言显示步骤，不依赖仓库文件或网络。 */
const guides: Record<SupportedLanguage, { title: string; introduction: string; update: string; updateStatus: string; steps: Array<[string, string]> }> = {
  "zh-CN": {
    title: "帮助与使用教程", introduction: "从添加目录到浏览、编辑和备份。", update: "版本与更新", updateStatus: "当前版本不提供自动检查或安装更新。更新前请先备份资料库。",
    steps: [
      ["1. 配置资料库", "首次启动选择内容目录，或到设置 → 资料库与目录管理目录。影片目录保存原文件，私人资料库保存作品资料、图片与个人偏好。普通设置在选择后或输入框失焦时保存。"],
      ["2. 导入与整理", "在导入与整理中同步全部或单个目录。同步依次处理 NFO、图片和媒体；也可使用高级预览确认导入内容。未识别的媒体可以之后手动关联作品。"],
      ["3. 浏览与返回", "作品库支持搜索、更多筛选和多种视图。瀑布流接近底部时加载更多；点击人物查看资料，返回上一页可逐级回到原作品。"],
      ["4. 编辑与标签", "在作品详情打开编辑，搜索并添加演员、题材和标签，点击已选标签的叉号移除关系。修改作品需要点击保存。分类浏览 → 标签 → 管理标签可以调整分类。空分类要分配至少一个标签后才会保存。"],
      ["5. 备份与排错", "设置 → 共享资料提供资料包导入导出。便携资料包不包含原视频，应另外备份影片和本机目录设置。关于 → 程序日志可查看失败原因，并打开日志所在位置。"],
      ["6. 更新程序", "安装版使用项目发布的较新安装包升级。源码版先拉取代码并安装依赖，再运行 build-desktop-exe.bat；结果位于 apps/desktop/src-tauri/target/release/localogue-desktop.exe。Webview 构建只生成前端资源，不会更新 EXE。开发版与发布版的设置和数据相互隔离。"],
    ],
  },
  ja: {
    title: "ヘルプと使い方", introduction: "フォルダー追加から閲覧・編集・バックアップまで。", update: "バージョンと更新", updateStatus: "自動更新の確認・インストールには未対応です。更新前にライブラリをバックアップしてください。",
    steps: [
      ["1. ライブラリ設定", "初回にコンテンツフォルダーを選択するか、設定で追加します。動画フォルダーは原本、プライベートライブラリは資料・画像・個人設定を保存します。通常設定は選択後または入力欄から離れると保存されます。"],
      ["2. インポートと整理", "全フォルダーまたは個別フォルダーを同期します。NFO、画像、動画の順に処理します。高度なプレビューで確認してからインポートすることもできます。未識別動画は後で作品に関連付けできます。"],
      ["3. 閲覧と戻る", "検索・詳細フィルター・表示切替を利用できます。ウォーターフォールは末尾で追加読込します。人物を開いた後は戻る操作で元の作品へ戻れます。"],
      ["4. 編集とタグ", "作品編集で出演者・ジャンル・タグを検索して追加します。選択済みチップの × で解除し、保存ボタンで確定します。分類一覧のタグ管理で分類を調整できます。空の分類はタグを割り当てるまで保存されません。"],
      ["5. バックアップと診断", "設定の共有資料からパックを入出力できます。動画原本と本機設定は含まれないため別途バックアップしてください。About のログ画面でエラーを確認できます。"],
      ["6. アップデート", "インストール版は新しい配布インストーラーを使用します。ソース版はコードと依存関係を更新して build-desktop-exe.bat を実行します。EXE は apps/desktop/src-tauri/target/release/localogue-desktop.exe に生成されます。Webview ビルドだけでは EXE は更新されません。開発版と公開版はデータを分離しています。"],
    ],
  },
  en: {
    title: "Help and getting started", introduction: "Set up folders, browse, edit and back up your library.", update: "Version and updates", updateStatus: "Automatic update checks and installation are not available yet. Back up your library before updating.",
    steps: [
      ["1. Set up a library", "Choose a content folder on first launch or manage folders in Settings. Video folders contain originals; the private library stores metadata, images and preferences. Ordinary settings save after selection or when a text field loses focus."],
      ["2. Import and organize", "Sync all folders or one folder. Sync processes NFO, images and media in that order. Advanced preview lets you inspect imports first. Unrecognized media can be linked to works later."],
      ["3. Browse and return", "Use search, advanced filters and view modes. Waterfall loads more near the bottom. Open a person from a work, then use Back to return through your previous details."],
      ["4. Edit and tag", "Search and add performers, genres and tags in the work editor. Remove selected relations with ×, then click Save. Manage tag categories under Browse → Tags. Empty categories are saved only after a tag is assigned."],
      ["5. Back up and diagnose", "Import and export packs under Settings → Shared data. Packs exclude original videos and machine-local settings; back these up separately. Open application logs from About to investigate failures."],
      ["6. Update the app", "For installed copies, use a newer project installer. For source builds, update code and dependencies, then run build-desktop-exe.bat. The output is apps/desktop/src-tauri/target/release/localogue-desktop.exe. Building the webview alone does not update the EXE. Development and release builds use separate settings and data."],
    ],
  },
};

export function DesktopHelp() {
  const { uiLanguage, t } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const guide = guides[uiLanguage];
  return <>
    <SettingsRow icon={<BookInformation20Regular />} title={guide.title} description={guide.introduction} action={<UiButton onClick={() => setOpen(true)}>{guide.title}</UiButton>} />
    <SettingsRow icon={<Info20Regular />} title={guide.update} description={guide.updateStatus} />
    <UiActionDialog open={open} onOpenChange={setOpen} title={guide.title} description={guide.introduction} closeLabel={t("关闭")} actions={<UiButton onClick={() => setOpen(false)}>{t("关闭")}</UiButton>}>
      {guide.steps.map(([title, body]) => <section key={title}><h3>{title}</h3><p>{body}</p></section>)}
    </UiActionDialog>
  </>;
}
