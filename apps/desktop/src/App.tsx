import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import type {
  DesktopBootstrapSettings,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopTaskProgress,
} from "./contracts";
import { desktopBridge } from "./tauri-bridge";
import {
  TauriFileDialogAdapter,
  TauriFileOpenerAdapter,
  TauriMediaProbeAdapter,
} from "./platform/tauri-platform-adapters";

const fileDialog = new TauriFileDialogAdapter();
const fileOpener = new TauriFileOpenerAdapter();
const mediaProbe = new TauriMediaProbeAdapter();

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  mediaScanPaths: [],
  webUrl: "http://127.0.0.1:3000",
};

export default function App() {
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null);
  const [settings, setSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [mediaPath, setMediaPath] = useState("");
  const [probe, setProbe] = useState<DesktopMediaProbeResult | null>(null);
  const [progress, setProgress] = useState<DesktopTaskProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在连接 Tauri Runtime…");

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void Promise.all([desktopBridge.runtimeInfo(), desktopBridge.loadSettings()])
      .then(([runtimeInfo, saved]) => {
        if (disposed) return;
        setRuntime(runtimeInfo);
        setSettings(saved);
        setMessage("Desktop Native Bridge 已连接。");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setMessage(`无法连接 Desktop Runtime：${toMessage(error)}`);
      });

    void desktopBridge.listenProgress((payload) => {
      if (!disposed) setProgress(payload);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const runtimeBadge = useMemo(() => {
    if (!runtime) return "connecting";
    return `${runtime.environment} · ${runtime.identifier}`;
  }, [runtime]);

  async function chooseLibrary(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({ ...current, libraryPath: path }));
  }

  async function addMediaDirectory(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({
      ...current,
      mediaScanPaths: Array.from(new Set([...current.mediaScanPaths, path])),
    }));
  }

  async function chooseMedia(): Promise<void> {
    const path = await fileDialog.pickFile();
    if (!path) return;
    setMediaPath(path);
    setProbe(null);
    setProgress(null);
  }

  async function saveSettings(): Promise<void> {
    setBusy(true);
    try {
      const saved = await desktopBridge.saveSettings(settings);
      setSettings(saved);
      setMessage("Desktop Bootstrap Settings 已保存。它与 Web 服务器 .localogue/settings.json 暂时分离。 ");
    } catch (error) {
      setMessage(`保存失败：${toMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function probeMedia(): Promise<void> {
    if (!mediaPath) return;
    setBusy(true);
    setProbe(null);
    try {
      const result = await mediaProbe.probe(settings.ffprobePath || "ffprobe", mediaPath);
      setProbe(result);
      setMessage("ffprobe Native Command 执行成功。");
    } catch (error) {
      setMessage(`ffprobe 失败：${toMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function openLocalogueWeb(): Promise<void> {
    try {
      await desktopBridge.openWebUrl(settings.webUrl);
      setMessage("已交给系统默认浏览器打开 Localogue Web。");
    } catch (error) {
      setMessage(`无法打开 Web URL：${toMessage(error)}`);
    }
  }

  async function openSelectedMedia(): Promise<void> {
    if (!mediaPath) return;
    try {
      await fileOpener.openPath(mediaPath);
      setMessage("已交给系统默认播放器打开媒体文件。");
    } catch (error) {
      setMessage(`无法打开媒体：${toMessage(error)}`);
    }
  }

  async function revealSelectedMedia(): Promise<void> {
    if (!mediaPath) return;
    try {
      await fileOpener.revealInFolder(mediaPath);
      setMessage("已在系统文件管理器中定位媒体文件。");
    } catch (error) {
      setMessage(`无法定位媒体：${toMessage(error)}`);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="eyebrow">LOCALOGUE · V1-13</div>
          <h1>Desktop Alpha</h1>
          <p>
            第一版桌面纵向链路：原生目录选择、AppData 隔离、文件打开/定位、Rust ffprobe 与 Tauri Event。
          </p>
        </div>
        <span className="runtime-badge">{runtimeBadge}</span>
      </header>

      <div className="status-line">{message}</div>

      <section className="grid two">
        <article className="card">
          <h2>Runtime</h2>
          <dl className="definition-list">
            <Row label="Product" value={runtime?.productName} />
            <Row label="Version" value={runtime?.version} />
            <Row label="App Config" value={runtime?.appConfigDir} mono />
            <Row label="App Local Data" value={runtime?.appLocalDataDir} mono />
            <Row label="Settings" value={runtime?.settingsPath} mono />
          </dl>
        </article>

        <article className="card">
          <h2>Web / Desktop 共存</h2>
          <p className="muted">
            V1-13 不移除 Next.js。Web 继续承担完整资料浏览与治理；Desktop 先建立可信原生能力边界。
          </p>
          <label>
            Web URL
            <input
              value={settings.webUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, webUrl: event.target.value }))}
            />
          </label>
          <button onClick={() => void openLocalogueWeb()}>在浏览器打开 Localogue Web</button>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Desktop Bootstrap Settings</h2>
            <p className="muted">开发版和正式版使用不同 Tauri identifier，因此 App Config / AppData 天然隔离。</p>
          </div>
          <button className="primary" disabled={busy} onClick={() => void saveSettings()}>保存桌面设置</button>
        </div>

        <div className="form-grid">
          <label>
            Private Library
            <div className="input-action">
              <input value={settings.libraryPath ?? ""} readOnly placeholder="尚未选择" />
              <button onClick={() => void chooseLibrary()}>选择目录</button>
            </div>
          </label>

          <label>
            ffprobe
            <input
              value={settings.ffprobePath ?? ""}
              placeholder="ffprobe"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, ffprobePath: event.target.value }))}
            />
          </label>
        </div>

        <div className="media-roots">
          <div className="section-heading compact">
            <strong>媒体扫描目录</strong>
            <button onClick={() => void addMediaDirectory()}>+ 原生选择目录</button>
          </div>
          {settings.mediaScanPaths.length ? (
            <ul className="path-list">
              {settings.mediaScanPaths.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                  <button className="ghost danger" onClick={() => setSettings((current) => ({
                    ...current,
                    mediaScanPaths: current.mediaScanPaths.filter((item) => item !== path),
                  }))}>移除</button>
                </li>
              ))}
            </ul>
          ) : <p className="empty">尚未添加媒体目录。</p>}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Native Media Probe Vertical Slice</h2>
            <p className="muted">这不是新的 Canonical 写入流程，只用于证明 Desktop → Rust → ffprobe → Event → Webview。</p>
          </div>
          <button onClick={() => void chooseMedia()}>选择媒体文件</button>
        </div>

        <div className="selected-file">
          <code>{mediaPath || "尚未选择媒体文件"}</code>
        </div>

        <div className="actions">
          <button className="primary" disabled={!mediaPath || busy} onClick={() => void probeMedia()}>运行 ffprobe</button>
          <button disabled={!mediaPath} onClick={() => void openSelectedMedia()}>默认播放器打开</button>
          <button disabled={!mediaPath} onClick={() => void revealSelectedMedia()}>资源管理器中定位</button>
        </div>

        {progress ? (
          <div className={`progress ${progress.stage}`}>
            <strong>{progress.stage}</strong>
            <span>{progress.message}</span>
          </div>
        ) : null}

        {probe ? (
          <dl className="probe-grid">
            <Row label="Duration" value={formatDuration(probe.durationSeconds)} />
            <Row label="Resolution" value={probe.width && probe.height ? `${probe.width} × ${probe.height}` : "—"} />
            <Row label="Video" value={probe.videoCodec} />
            <Row label="Audio" value={probe.audioCodec} />
            <Row label="Container" value={probe.container} />
          </dl>
        ) : null}
      </section>

      <footer>
        V1-13 是 Desktop Runtime Alpha，不宣称 Web / Desktop UI 已达到功能对等。V1-14 将把扫描协调器和更多 Platform Adapter 接进桌面运行时。
      </footer>
    </main>
  );
}

function Row({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return <div><dt>{label}</dt><dd className={mono ? "mono" : ""}>{value || "—"}</dd></div>;
}

function formatDuration(value?: number): string {
  if (!value || !Number.isFinite(value)) return "—";
  const total = Math.round(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
