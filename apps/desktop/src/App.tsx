import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { MediaScanCoordinator } from "../../../src/application/media/media-scan-coordinator";
import type { MediaScanJobSnapshot } from "../../../src/domain/entities/media-scan";

import type {
  DesktopBootstrapSettings,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopTaskProgress,
} from "./contracts";
import { desktopBridge } from "./tauri-bridge";
import {
  TauriFileDialogAdapter,
  TauriFileHashAdapter,
  TauriFileOpenerAdapter,
  TauriFileSystemAdapter,
  TauriMediaProbeAdapter,
  tauriDesktopCapabilities,
} from "./platform/tauri-platform-adapters";
import { TauriScanRepository } from "./platform/tauri-scan-repository";

const fileDialog = new TauriFileDialogAdapter();
const fileOpener = new TauriFileOpenerAdapter();
const mediaProbe = new TauriMediaProbeAdapter();
const fileSystem = new TauriFileSystemAdapter();
const fileHash = new TauriFileHashAdapter();

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  mediaScanPaths: [],
  sharedPackPaths: [],
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
  const [scan, setScan] = useState<MediaScanJobSnapshot | null>(null);
  const scanCoordinator = useRef<MediaScanCoordinator | null>(null);

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
      setMessage("实例设置已保存；字段语义与 Web Instance Settings 保持一致，Desktop 运行入口独立保存路径。 ");
    } catch (error) {
      setMessage(`保存失败：${toMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function startScan(): Promise<void> {
    if (!settings.libraryPath) { setMessage("请先选择 Private Library。"); return; }
    if (!settings.mediaScanPaths.length) { setMessage("请先添加至少一个媒体扫描目录。"); return; }
    try {
      const saved = await desktopBridge.saveSettings(settings);
      setSettings(saved);
      const repository = new TauriScanRepository(saved.libraryPath as string);
      const platform = { fileSystem, fileHash, mediaProbe, fileDialog, fileOpener, capabilities: tauriDesktopCapabilities };
      const coordinator = new MediaScanCoordinator(repository, platform);
      scanCoordinator.current = coordinator;
      setScan(coordinator.start({
        roots: saved.mediaScanPaths,
        ffprobeExecutable: saved.ffprobePath?.trim() || "ffprobe",
        probeMedia: true,
        computeSha256: false,
        pruneMissing: true,
      }));
      setMessage("Desktop 增量媒体扫描已启动。");
      const timer = window.setInterval(() => {
        const snapshot = coordinator.getSnapshot();
        setScan(snapshot);
        if (snapshot && !["running", "cancelling"].includes(snapshot.status)) {
          window.clearInterval(timer);
          setMessage(snapshot.status === "completed" ? "Desktop 增量媒体扫描完成。" : snapshot.progress.message ?? "媒体扫描已结束。");
        }
      }, 250);
    } catch (error) { setMessage(`无法启动扫描：${toMessage(error)}`); }
  }

  function cancelScan(): void {
    setScan(scanCoordinator.current?.cancel() ?? null);
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
          <div className="eyebrow">LOCALOGUE · V1-14</div>
          <h1>Desktop Runtime Integration</h1>
          <p>
            共享 Media Scan Application Core、原生 FileSystem / FileHash / ffprobe 与可取消增量扫描。
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
            Next.js 继续承担完整资料浏览与治理；Desktop 复用同一资料库、扫描规则与设置字段语义。
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
            <h2>Desktop Incremental Media Scan</h2>
            <p className="muted">使用 V1-12 同一 Application Core；未变化文件跳过 ffprobe、Hash 与 JSON 重写。</p>
          </div>
          <div className="actions">
            <button className="primary" disabled={scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void startScan()}>开始增量扫描</button>
            <button disabled={scan?.status !== "running"} onClick={cancelScan}>取消</button>
          </div>
        </div>
        {scan ? (
          <div className={`progress ${scan.status}`}>
            <strong>{scan.status} · {scan.progress.phase}</strong>
            <span>{scan.progress.message}</span>
            <span>{scan.progress.current} / {scan.progress.total}</span>
          </div>
        ) : <p className="empty">尚未运行桌面扫描。</p>}
        {scan?.result ? (
          <dl className="probe-grid">
            <Row label="Discovered" value={String(scan.result.discovered)} />
            <Row label="Added" value={String(scan.result.added)} />
            <Row label="Updated" value={String(scan.result.updated)} />
            <Row label="Unchanged" value={String(scan.result.unchanged)} />
            <Row label="Probed" value={String(scan.result.probed)} />
            <Row label="Removed" value={String(scan.result.removed)} />
          </dl>
        ) : null}
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
        V1-14 完成 Desktop Runtime Integration；Web 与 Desktop 继续是两个入口，但共享 Domain / Application 规则。
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
