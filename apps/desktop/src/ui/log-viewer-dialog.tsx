import * as Dialog from "@radix-ui/react-dialog";
import { ArrowClockwise20Regular, Dismiss20Regular, FolderOpen20Regular } from "@fluentui/react-icons";
import { useMemo, useState, type ReactNode } from "react";

import { useDesktopI18n } from "../desktop-i18n";
import { desktopBridge } from "../tauri-bridge";
import { UiButton } from "./button";
import { UiEmptyState } from "./feedback";
import { UiSelectField, UiTextField } from "./form-control";

type LogLevel = "all" | "INFO" | "WARN" | "ERROR";

/** 应用内日志查看器。Native 端只允许读取固定日志，组件只负责筛选与展示。 */
export function LogViewerDialog({ trigger, setMessage }: { trigger: ReactNode; setMessage: (message: string) => void }) {
  const { t } = useDesktopI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rawLog, setRawLog] = useState("");
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState<LogLevel>("all");

  const lines = useMemo(() => rawLog.split(/\r?\n/).filter(Boolean).slice(-1000).filter((line) => {
    if (level !== "all" && !line.includes(`[${level}]`)) return false;
    return !keyword.trim() || line.toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase());
  }), [keyword, level, rawLog]);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      setRawLog(await desktopBridge.readAppLog());
    } catch (error) {
      setMessage(t("读取程序日志失败：{error}", { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setLoading(false);
    }
  }

  async function reveal(): Promise<void> {
    try {
      await desktopBridge.revealAppLog();
    } catch (error) {
      setMessage(t("无法打开日志位置：{error}", { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  return <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) void refresh(); }}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="ui-dialog-overlay" />
      <Dialog.Content className="ui-dialog-content log-viewer-dialog" aria-describedby="log-viewer-description">
        <div className="ui-dialog-header">
          <div><Dialog.Title>{t("程序日志")}</Dialog.Title><Dialog.Description id="log-viewer-description">{t("显示当前日志最近 1000 行；可以按级别和关键词筛选。")}</Dialog.Description></div>
          <Dialog.Close asChild><UiButton aria-label={t("关闭")} icon={<Dismiss20Regular />} size="icon" variant="ghost" /></Dialog.Close>
        </div>
        <div className="log-viewer-toolbar">
          <UiSelectField label={t("日志级别")} value={level} onChange={(event) => setLevel(event.target.value as LogLevel)}><option value="all">{t("全部")}</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option></UiSelectField>
          <UiTextField className="log-viewer-search" label={t("关键词")} value={keyword} placeholder={t("筛选日志内容")} onChange={(event) => setKeyword(event.target.value)} />
          <UiButton icon={<ArrowClockwise20Regular />} loading={loading} onClick={() => void refresh()}>{loading ? t("读取中…") : t("刷新")}</UiButton>
          <UiButton icon={<FolderOpen20Regular />} onClick={() => void reveal()}>{t("打开文件所在位置")}</UiButton>
        </div>
        <div className="log-viewer-summary">{t("显示 {visible} 行，当前日志共 {total} 行。", { visible: lines.length, total: rawLog.split(/\r?\n/).filter(Boolean).length })}</div>
        <div className="log-viewer-table" role="log" aria-live="polite">
          {lines.length ? lines.map((line, index) => <div className="log-viewer-line" key={`${index}-${line}`}><span>{index + 1}</span><code>{line}</code></div>) : <UiEmptyState title={loading ? t("正在读取日志…") : t("没有符合条件的日志。")} />}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
