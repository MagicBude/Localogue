"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

interface ProfileSwitcherProps {
  label: string;
}

interface ProfileSummary {
  id: string;
  name: string;
}

interface SettingsResponse {
  settings: {
    libraryProfiles?: ProfileSummary[];
    activeLibraryProfileId?: string;
  };
}

/**
 * 顶栏资料库切换器，与桌面端侧栏的 Profile 下拉对齐。
 * 只有存在多个资料库时才显示；单资料库时无需切换。
 */
export function ProfileSwitcher({ label }: ProfileSwitcherProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: SettingsResponse) => {
        if (cancelled) return;
        setProfiles(data.settings.libraryProfiles ?? []);
        setActiveId(data.settings.activeLibraryProfileId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (profiles.length <= 1) return null;

  async function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    if (!id || id === activeId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "switch", id }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "切换资料库失败。");
      }
      // 只有服务端确认设置文件已写入后才更新选择框。这样写入失败时，界面不会
      // 假装已经切换到另一个资料库，随后又显示旧资料而让用户困惑。
      setActiveId(id);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="profile-switcher">
      <span className="profile-switcher__label">{label}</span>
      <select value={activeId ?? ""} onChange={onChange} disabled={busy}>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{profile.name}</option>
        ))}
      </select>
    </label>
  );
}
