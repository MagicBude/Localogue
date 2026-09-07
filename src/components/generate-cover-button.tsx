"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getUiDictionary } from "@/i18n/ui";

interface GenerateCoverButtonProps {
  workId: string;
  language: SupportedLanguage;
}

/**
 * 触发“从视频抽帧生成封面”的客户端按钮。
 *
 * 调用 /api/works/[id]/cover-frame；成功后刷新当前页（封面偏好已写入，
 * resolveWorkCoverAsset 会优先采用 preferredCoverAssetId）。失败时按返回原因展示提示。
 */
export function GenerateCoverButton({ workId, language }: GenerateCoverButtonProps) {
  const dictionary = getUiDictionary(language);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setStatus("working");
    setMessage("");
    try {
      const response = await fetch(`/api/works/${encodeURIComponent(workId)}/cover-frame`, {
        method: "POST",
      });
      const payload = await response.json() as {
        ok: boolean;
        reason?: string;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.message ?? dictionary.coverGenerateFailed);
        return;
      }
      setStatus("done");
      setMessage(dictionary.coverGenerated);
      router.refresh();
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error ? caught.message : dictionary.coverGenerateFailed);
    }
  }

  return (
    <div className="generate-cover">
      <button
        type="button"
        className="secondary-button"
        disabled={status === "working"}
        onClick={handleClick}
      >
        {status === "working" ? dictionary.generatingCover : dictionary.generateCover}
      </button>
      {message ? (
        <span className={status === "error" ? "error-text" : "success-text"}>{message}</span>
      ) : null}
    </div>
  );
}
