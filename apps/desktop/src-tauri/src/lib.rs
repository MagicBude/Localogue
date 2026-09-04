use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashSet, VecDeque},
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use url::Url;

const PROGRESS_EVENT: &str = "localogue://desktop-task-progress";
const SETTINGS_FILE: &str = "desktop-settings.json";
const MAX_PORTABLE_PACK_BYTES: usize = 256 * 1024 * 1024;
static NATIVE_IO_SEQUENCE: AtomicU64 = AtomicU64::new(1);
const SAFE_MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "m4v", "ts", "mts", "m2ts", "webm", "flv",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeInfo {
    runtime: &'static str,
    product_name: String,
    version: String,
    identifier: String,
    environment: &'static str,
    app_config_dir: String,
    app_local_data_dir: String,
    settings_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopBootstrapSettings {
    schema_version: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    library_path: Option<String>,
    #[serde(default)]
    library_roots: Vec<String>,
    #[serde(default)]
    media_scan_paths: Vec<String>,
    #[serde(default)]
    nfo_scan_paths: Vec<String>,
    #[serde(default)]
    shared_pack_paths: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ffprobe_path: Option<String>,
    web_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
}

impl Default for DesktopBootstrapSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            library_path: None,
            library_roots: Vec::new(),
            media_scan_paths: Vec::new(),
            nfo_scan_paths: Vec::new(),
            shared_pack_paths: Vec::new(),
            ffprobe_path: None,
            web_url: "http://127.0.0.1:3000".into(),
            updated_at: None,
        }
    }
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSharedPackInfo {
    configured_path: String,
    absolute_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    library_path: Option<String>,
    valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    license: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaProbeRequest {
    executable: String,
    file_path: String,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaProbeResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    video_codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audio_codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    container: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopFileStat {
    is_file: bool,
    is_directory: bool,
    size: u64,
    modified_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopFileEntry {
    path: String,
    name: String,
    extension: String,
    size: u64,
    modified_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopImportedAssetFile {
    storage_path: String,
    mime_type: String,
    file_size: u64,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPortableFile {
    path: String,
    bytes: Vec<u8>,
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WalkFilesRequest {
    root: String,
    #[serde(default)]
    extensions: Vec<String>,
    #[serde(default)]
    include_hidden: bool,
    max_files: Option<usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DesktopTaskProgress {
    task_id: String,
    task_type: &'static str,
    stage: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_path: Option<String>,
}

#[tauri::command]
fn get_runtime_info(app: AppHandle) -> Result<DesktopRuntimeInfo, String> {
    let config_dir = app.path().app_config_dir().map_err(display_error)?;
    let local_data_dir = app.path().app_local_data_dir().map_err(display_error)?;
    let package = app.package_info();
    Ok(DesktopRuntimeInfo {
        runtime: "tauri",
        product_name: app.config().product_name.clone().unwrap_or_else(|| package.name.clone()),
        version: package.version.to_string(),
        identifier: app.config().identifier.clone(),
        environment: if cfg!(debug_assertions) { "development" } else { "production" },
        app_config_dir: path_to_string(&config_dir),
        app_local_data_dir: path_to_string(&local_data_dir),
        settings_path: path_to_string(&config_dir.join(SETTINGS_FILE)),
    })
}

#[tauri::command]
fn load_desktop_settings(app: AppHandle) -> Result<DesktopBootstrapSettings, String> {
    let path = desktop_settings_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(raw) => {
            let parsed: DesktopBootstrapSettings = serde_json::from_str(&raw).map_err(display_error)?;
            normalize_settings(parsed)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(DesktopBootstrapSettings::default()),
        Err(error) => Err(format!("无法读取 Desktop Settings：{error}")),
    }
}

#[tauri::command]
fn save_desktop_settings(app: AppHandle, settings: DesktopBootstrapSettings) -> Result<DesktopBootstrapSettings, String> {
    let mut normalized = normalize_settings(settings)?;
    normalized.updated_at = Some(now_marker());
    let path = desktop_settings_path(&app)?;
    let parent = path.parent().ok_or_else(|| "Desktop Settings 路径缺少父目录。".to_string())?;
    fs::create_dir_all(parent).map_err(display_error)?;
    let temporary = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(&normalized).map_err(display_error)? + "\n";
    fs::write(&temporary, body).map_err(display_error)?;
    if path.exists() {
        fs::remove_file(&path).map_err(display_error)?;
    }
    fs::rename(&temporary, &path).map_err(display_error)?;
    Ok(normalized)
}

#[tauri::command]
async fn pick_directory(app: AppHandle) -> Result<Option<String>, String> {
    Ok(app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|selected| selected.into_path().ok())
        .map(|path| path_to_string(&path)))
}

#[tauri::command]
async fn pick_media_file(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Media", &["mp4", "mkv", "avi", "mov", "wmv", "m4v", "ts", "mts", "m2ts", "webm", "flv"])
        .blocking_pick_file();
    Ok(picked
        .and_then(|selected| selected.into_path().ok())
        .map(|path| path_to_string(&path)))
}

#[tauri::command]
async fn pick_portable_pack_file(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().add_filter("Localogue Pack", &["localogue-pack"]).blocking_pick_file();
    Ok(picked.and_then(|selected| selected.into_path().ok()).map(|path| path_to_string(&path)))
}

#[tauri::command]
async fn read_portable_pack_file(path: String) -> Result<Vec<u8>, String> {
    spawn_native_io("read_portable_pack_file", move || {
        let file = require_existing_file(&path)?;
        if file.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("localogue-pack")) != Some(true) {
            return Err("只允许读取 .localogue-pack 文件。".into());
        }
        let metadata = fs::metadata(&file).map_err(display_error)?;
        if metadata.len() > MAX_PORTABLE_PACK_BYTES as u64 { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }
        fs::read(file).map_err(display_error)
    }).await
}

#[tauri::command]
async fn save_portable_pack_file(app: AppHandle, suggested_name: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
    if bytes.len() > MAX_PORTABLE_PACK_BYTES { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }
    let safe_name = if suggested_name.ends_with(".localogue-pack") { suggested_name } else { format!("{suggested_name}.localogue-pack") };
    let picked = app.dialog().file().add_filter("Localogue Pack", &["localogue-pack"]).set_file_name(&safe_name).blocking_save_file();
    let Some(path) = picked.and_then(|selected| selected.into_path().ok()) else { return Ok(None); };
    let target = path_to_string(&path);
    spawn_native_io("save_portable_pack_file", move || fs::write(&path, bytes).map_err(display_error)).await?;
    Ok(Some(target))
}

#[tauri::command]
async fn collect_private_portable_files(app: AppHandle) -> Result<Vec<DesktopPortableFile>, String> {
    spawn_native_io("collect_private_portable_files", move || {
        let root = PathBuf::from(configured_private_library_path(&app)?);
        collect_portable_files(&root, &[
            "works", "people", "organizations", "series", "genres", "tags", "assets", "asset-files",
            "presentation-preferences", "evidence", "evidence-lifecycle", "review-commits", "snapshots",
            "restore-receipts", "provenance", "person-edits", "media-binding-receipts",
        ])
    }).await
}

#[tauri::command]
async fn import_private_portable_files(app: AppHandle, files: Vec<DesktopPortableFile>) -> Result<Value, String> {
    spawn_native_io("import_private_portable_files", move || {
        let root = PathBuf::from(configured_private_library_path(&app)?);
        let allowed = [
            "works", "people", "organizations", "series", "genres", "tags", "assets", "asset-files",
            "presentation-preferences", "evidence", "evidence-lifecycle", "review-commits", "snapshots",
            "restore-receipts", "provenance", "person-edits", "media-binding-receipts",
        ];
        let total_bytes = files.iter().try_fold(0_usize, |total, file| total.checked_add(file.bytes.len()).ok_or_else(|| "Portable Pack 大小溢出。".to_string()))?;
        if total_bytes > MAX_PORTABLE_PACK_BYTES { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }
        let mut imported = 0_u64;
        let mut skipped = 0_u64;
        let mut created: Vec<PathBuf> = Vec::new();
        let result: Result<(), String> = (|| {
            for file in files {
                let target = safe_portable_relative_path(&root, &file.path, &allowed)?;
                if target.exists() { skipped += 1; continue; }
                if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(display_error)?; }
                fs::write(&target, file.bytes).map_err(display_error)?;
                created.push(target);
                imported += 1;
            }
            Ok(())
        })();
        if let Err(error) = result {
            for path in created.iter().rev() {
                let _ = fs::remove_file(path);
            }
            return Err(format!("Personal Portable Pack 导入失败，已回滚本次新建文件：{error}"));
        }
        Ok(serde_json::json!({"imported": imported, "skipped": skipped}))
    }).await
}

#[tauri::command]
async fn collect_shared_portable_files(app: AppHandle, pack_path: String) -> Result<Vec<DesktopPortableFile>, String> {
    spawn_native_io("collect_shared_portable_files", move || {
        let settings = load_desktop_settings(app.clone())?;
        if !settings.shared_pack_paths.iter().any(|item| item == &pack_path) { return Err("只能导出当前 Desktop 已挂载的 Shared Pack。".into()); }
        let info = inspect_shared_pack(pack_path)?;
        if !info.valid { return Err(info.error.unwrap_or_else(|| "Shared Pack 无效。".into())); }
        let root = PathBuf::from(info.absolute_path);
        let mut files = collect_portable_files(&root, &["library", "sources"])?;
        let manifest = root.join("localogue-pack.json");
        files.push(DesktopPortableFile { path: "localogue-pack.json".into(), bytes: fs::read(manifest).map_err(display_error)? });
        files.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(files)
    }).await
}

#[tauri::command]
async fn install_shared_portable_files(app: AppHandle, source_id: String, source_version: String, files: Vec<DesktopPortableFile>) -> Result<String, String> {
    spawn_native_io("install_shared_portable_files", move || {
        let total_bytes = files.iter().try_fold(0_usize, |total, file| total.checked_add(file.bytes.len()).ok_or_else(|| "Portable Pack 大小溢出。".to_string()))?;
        if total_bytes > MAX_PORTABLE_PACK_BYTES { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }
        if !is_safe_id(&source_id) || source_version.trim().is_empty() || source_version.contains('/') || source_version.contains('\\') {
            return Err("Shared Portable Pack id/version 不安全。".into());
        }
        let base = app.path().app_local_data_dir().map_err(display_error)?.join("packs");
        fs::create_dir_all(&base).map_err(display_error)?;
        let version_token: String = source_version.chars().map(|ch| if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') { ch } else { '-' }).collect();
        let token = format!("{}-{}", source_id, version_token);
        let root = base.join(&token);
        if root.exists() {
            let existing = inspect_shared_pack(path_to_string(&root))?;
            if existing.valid && existing.id.as_deref() == Some(source_id.as_str()) && existing.version.as_deref() == Some(source_version.as_str()) {
                return Ok(path_to_string(&root));
            }
            return Err("同 id/version 的 Shared Pack 安装目录已存在但无法安全复用，请先在 Desktop 中卸载或手工清理该安装目录。".into());
        }

        let temp = base.join(format!(".{}.import-{}", token, now_marker()));
        if temp.exists() { fs::remove_dir_all(&temp).map_err(display_error)?; }
        fs::create_dir_all(&temp).map_err(display_error)?;
        let allowed = ["library", "sources"];
        let install_result: Result<(), String> = (|| {
            for file in files {
                let target = if file.path == "localogue-pack.json" {
                    temp.join("localogue-pack.json")
                } else {
                    safe_portable_relative_path(&temp, &file.path, &allowed)?
                };
                if target.exists() { return Err(format!("Shared Portable Pack 包内出现重复目标路径：{}", file.path)); }
                if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(display_error)?; }
                fs::write(&target, file.bytes).map_err(display_error)?;
            }
            let info = inspect_shared_pack(path_to_string(&temp))?;
            if !info.valid { return Err(info.error.unwrap_or_else(|| "安装后的 Shared Pack 校验失败。".into())); }
            if info.id.as_deref() != Some(source_id.as_str()) || info.version.as_deref() != Some(source_version.as_str()) {
                return Err("Portable Envelope 与 localogue-pack.json 的 source id/version 不一致。".into());
            }
            fs::rename(&temp, &root).map_err(|error| format!("无法原子完成 Shared Pack 安装：{error}"))?;
            Ok(())
        })();
        if let Err(error) = install_result {
            let _ = fs::remove_dir_all(&temp);
            return Err(error);
        }
        Ok(path_to_string(&root))
    }).await
}

fn collect_portable_files(root: &Path, directories: &[&str]) -> Result<Vec<DesktopPortableFile>, String> {
    let mut result = Vec::new();
    let mut total_bytes = 0_usize;
    for directory in directories {
        let base = root.join(directory);
        if !base.is_dir() { continue; }
        let mut queue = VecDeque::from([base]);
        while let Some(current) = queue.pop_front() {
            for entry in fs::read_dir(&current).map_err(display_error)? {
                let entry = entry.map_err(display_error)?;
                let file_type = entry.file_type().map_err(display_error)?;
                if file_type.is_symlink() { continue; }
                let path = entry.path();
                if file_type.is_dir() { queue.push_back(path); continue; }
                if !file_type.is_file() { continue; }
                let relative = path.strip_prefix(root).map_err(display_error)?.to_string_lossy().replace('\\', "/");
                let bytes = fs::read(path).map_err(display_error)?;
                total_bytes = total_bytes.checked_add(bytes.len()).ok_or_else(|| "Portable Pack 大小溢出。".to_string())?;
                if total_bytes > MAX_PORTABLE_PACK_BYTES { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }
                result.push(DesktopPortableFile { path: relative, bytes });
            }
        }
    }
    result.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(result)
}

fn safe_portable_relative_path(root: &Path, relative: &str, allowed: &[&str]) -> Result<PathBuf, String> {
    let normalized = relative.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains('\0') { return Err(format!("Portable 路径不安全：{relative}")); }
    let parts: Vec<&str> = normalized.split('/').collect();
    if parts.len() < 2 || parts.iter().any(|part| part.is_empty() || *part == "." || *part == "..") || !allowed.contains(&parts[0]) {
        return Err(format!("Portable 路径不在白名单：{relative}"));
    }
    Ok(parts.into_iter().fold(root.to_path_buf(), |path, part| path.join(part)))
}

#[tauri::command]
fn open_path(app: AppHandle, path: String) -> Result<(), String> {
    let target = require_existing_file(&path)?;
    require_safe_media_extension(&target)?;
    app.opener().open_path(path_to_string(&target), None::<&str>).map_err(display_error)
}

#[tauri::command]
fn reveal_in_folder(app: AppHandle, path: String) -> Result<(), String> {
    let target = require_existing_path(path)?;
    app.opener().reveal_item_in_dir(&target).map_err(display_error)
}

#[tauri::command]
fn open_web_url(app: AppHandle, url: String) -> Result<(), String> {
    let normalized = url.trim();
    let parsed = Url::parse(normalized).map_err(|error| format!("Localogue Web URL 无效：{error}"))?;
    let allowed_host = matches!(parsed.host_str(), Some("localhost") | Some("127.0.0.1"));
    if parsed.scheme() != "http" || !allowed_host || parsed.username() != "" || parsed.password().is_some() {
        return Err("V1-13 Desktop Alpha 只允许从此按钮打开 http://localhost 或 http://127.0.0.1。".into());
    }
    app.opener().open_url(parsed.as_str(), None::<&str>).map_err(display_error)
}

#[tauri::command]
async fn probe_media(app: AppHandle, request: MediaProbeRequest) -> Result<MediaProbeResult, String> {
    let task_id = format!("probe-{}", now_marker());
    emit_progress(&app, &task_id, "preparing", "正在验证媒体与 ffprobe。", Some(&request.file_path));

    let file_path = require_existing_file(&request.file_path)?;
    let executable = resolve_ffprobe_executable(&request.executable)?;
    emit_progress(&app, &task_id, "probing", "正在通过 Rust Command 调用 ffprobe。", Some(&request.file_path));

    let output = spawn_native_io("probe_media", move || {
        Command::new(&executable)
            .args([
                "-v", "error",
                "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,width,height",
                "-of", "json",
            ])
            .arg(&file_path)
            .output()
            .map_err(|error| format!("无法启动 ffprobe：{error}"))
    })
    .await
    .map_err(|error| {
        emit_progress(&app, &task_id, "failed", &format!("ffprobe 启动失败：{error}"), Some(&request.file_path));
        error
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        emit_progress(&app, &task_id, "failed", "ffprobe 返回非零状态。", Some(&request.file_path));
        return Err(if stderr.is_empty() { "ffprobe 返回非零状态。".into() } else { stderr });
    }

    let parsed: Value = serde_json::from_slice(&output.stdout).map_err(|error| format!("无法解析 ffprobe JSON：{error}"))?;
    let streams = parsed.get("streams").and_then(Value::as_array);
    let video = streams.and_then(|items| items.iter().find(|item| item.get("codec_type").and_then(Value::as_str) == Some("video")));
    let audio = streams.and_then(|items| items.iter().find(|item| item.get("codec_type").and_then(Value::as_str) == Some("audio")));
    let format = parsed.get("format");
    let result = MediaProbeResult {
        duration_seconds: format.and_then(|value| value.get("duration")).and_then(Value::as_str).and_then(|value| value.parse::<f64>().ok()),
        width: video.and_then(|value| value.get("width")).and_then(Value::as_u64),
        height: video.and_then(|value| value.get("height")).and_then(Value::as_u64),
        video_codec: video.and_then(|value| value.get("codec_name")).and_then(Value::as_str).map(str::to_string),
        audio_codec: audio.and_then(|value| value.get("codec_name")).and_then(Value::as_str).map(str::to_string),
        container: format.and_then(|value| value.get("format_name")).and_then(Value::as_str).map(str::to_string),
    };
    emit_progress(&app, &task_id, "completed", "媒体技术参数读取完成。", Some(&request.file_path));
    Ok(result)
}

#[tauri::command]
fn resolve_path(path: String) -> Result<String, String> {
    validate_text_path(&path)?;
    let input = PathBuf::from(path);
    let resolved = if input.is_absolute() { input } else { std::env::current_dir().map_err(display_error)?.join(input) };
    Ok(path_to_string(&normalize_lexical(&resolved)))
}

#[tauri::command]
async fn stat_path(path: String) -> Result<DesktopFileStat, String> {
    spawn_native_io("stat_path", move || stat_path_blocking(path)).await
}

fn stat_path_blocking(path: String) -> Result<DesktopFileStat, String> {
    validate_text_path(&path)?;
    let metadata = fs::metadata(&path).map_err(display_error)?;
    Ok(DesktopFileStat {
        is_file: metadata.is_file(),
        is_directory: metadata.is_dir(),
        size: metadata.len(),
        modified_at: modified_marker(&metadata)?,
    })
}

#[tauri::command]
async fn path_exists(path: String) -> Result<bool, String> {
    spawn_native_io("path_exists", move || path_exists_blocking(path)).await
}

fn path_exists_blocking(path: String) -> Result<bool, String> {
    validate_text_path(&path)?;
    Ok(Path::new(&path).exists())
}

#[tauri::command]
async fn walk_files(request: WalkFilesRequest) -> Result<Vec<DesktopFileEntry>, String> {
    // 目录枚举属于可能耗时的阻塞 I/O。不要让它占用 Tauri 主线程；同时把真正的遍历
    // 放到显式迭代队列中，避免任何目录深度或目录环把调用栈压爆。
    spawn_native_io("walk_files", move || walk_files_blocking(request)).await
}

fn walk_files_blocking(request: WalkFilesRequest) -> Result<Vec<DesktopFileEntry>, String> {
    const MAX_VISITED_DIRECTORIES: usize = 100_000;

    validate_text_path(&request.root)?;
    let configured_root = PathBuf::from(&request.root);
    let root = resolve_scan_root(&configured_root)?;
    let allowed: HashSet<String> = request.extensions.into_iter()
        .map(|value| value.trim_start_matches('.').to_ascii_lowercase()).collect();
    let limit = request.max_files.unwrap_or(25_000).min(25_000);

    eprintln!(
        "[Localogue Desktop] walk_files start root={} extensions={} limit={}",
        path_to_string(&root),
        allowed.len(),
        limit
    );

    let mut output = Vec::new();
    let mut pending = VecDeque::from([root.clone()]);
    let mut visited = HashSet::from([scan_visit_key(&root)]);

    while let Some(directory) = pending.pop_front() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) if directory == root => {
                return Err(format!(
                    "无法读取资料扫描根路径 {}：{error}",
                    path_to_string(&directory)
                ));
            }
            Err(error) => {
                eprintln!(
                    "[Localogue Desktop] walk_files skip unreadable directory={} error={}",
                    path_to_string(&directory),
                    error
                );
                continue;
            }
        };

        for entry in entries {
            if output.len() >= limit {
                eprintln!(
                    "[Localogue Desktop] walk_files reached file limit root={} files={} dirs={}",
                    path_to_string(&root),
                    output.len(),
                    visited.len()
                );
                return Ok(output);
            }

            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    eprintln!("[Localogue Desktop] walk_files skip unreadable entry error={error}");
                    continue;
                }
            };
            let path = entry.path();

            if !request.include_hidden && is_hidden_relative_path(&root, &path) { continue; }

            // symlink_metadata 不跟随符号链接。Windows 下对目录额外拒绝 Reparse Point
            // （包括 junction），避免资料库目录通过挂载点重新指回祖先目录形成环。
            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(error) => {
                    eprintln!(
                        "[Localogue Desktop] walk_files skip metadata path={} error={}",
                        path_to_string(&path),
                        error
                    );
                    continue;
                }
            };
            let file_type = metadata.file_type();
            if file_type.is_symlink() { continue; }

            if metadata.is_dir() {
                // 只阻止 Reparse Point 目录继续下钻。Windows Cloud Files / 虚拟卷可能把
                // 普通文件也标记为 reparse point；那些文件仍应允许进入扩展名筛选。
                if is_filesystem_reparse_point(&metadata) { continue; }
                // 不把 fs::canonicalize 作为扫描前提。部分 Windows 卷、虚拟盘、网络/挂载卷
                // 可以正常 read_dir，却会让 canonicalize/GetFinalPathNameByHandle 返回 OS 1005。
                // 由于子目录 symlink/junction/reparse point 已经明确不跟随，普通目录树不会产生环；
                // visited 只需对当前逻辑绝对路径做词法归一化即可。
                let visit_key = scan_visit_key(&path);
                if visited.insert(visit_key) {
                    if visited.len() > MAX_VISITED_DIRECTORIES {
                        return Err(format!(
                            "资料扫描目录数量超过安全上限 {MAX_VISITED_DIRECTORIES}；请缩小 Unified Library Root。"
                        ));
                    }
                    pending.push_back(path);
                }
                continue;
            }

            if !metadata.is_file() { continue; }
            let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
            if !allowed.is_empty() && !allowed.contains(&extension) { continue; }
            output.push(DesktopFileEntry {
                path: path_to_string(&path),
                name: entry.file_name().to_string_lossy().into_owned(),
                extension: format!(".{extension}"),
                size: metadata.len(),
                modified_at: modified_marker(&metadata)?,
            });
        }
    }

    eprintln!(
        "[Localogue Desktop] walk_files completed root={} files={} dirs={}",
        path_to_string(&root),
        output.len(),
        visited.len()
    );
    Ok(output)
}

fn resolve_scan_root(configured_root: &Path) -> Result<PathBuf, String> {
    // Windows 的某些可读卷/虚拟盘不支持 fs::canonicalize，但 read_dir 完全可用。
    // 扫描只需要一个稳定的绝对词法路径，不应把“能否取得最终设备路径”当成可扫描条件。
    let root = if configured_root.is_absolute() {
        normalize_lexical(configured_root)
    } else {
        let current = std::env::current_dir().map_err(|error| format!("无法解析当前工作目录：{error}"))?;
        normalize_lexical(&current.join(configured_root))
    };

    let metadata = fs::metadata(&root)
        .map_err(|error| format!("无法读取资料扫描根路径 {}：{error}", path_to_string(&root)))?;
    if !metadata.is_dir() {
        return Err(format!("资料扫描根路径不是目录：{}", path_to_string(&root)));
    }
    // 主动 probe 一次根目录。这里失败才说明这个根确实不可枚举；子目录失败仍采用跳过策略。
    fs::read_dir(&root)
        .map_err(|error| format!("无法枚举资料扫描根路径 {}：{error}", path_to_string(&root)))?;
    Ok(root)
}

fn scan_visit_key(path: &Path) -> String {
    let normalized = normalize_lexical(path);
    #[cfg(windows)]
    {
        // Windows 路径比较通常不区分大小写。这里仅用于同一次扫描的 visited 去重，
        // 不把这个字符串重新用于文件系统访问。
        return path_to_string(&normalized).replace('/', "\\").to_ascii_lowercase();
    }
    #[cfg(not(windows))]
    {
        path_to_string(&normalized)
    }
}

fn is_hidden_relative_path(root: &Path, path: &Path) -> bool {
    path.strip_prefix(root)
        .ok()
        .map(|relative| {
            relative.components().any(|part| {
                part.as_os_str().to_string_lossy().starts_with('.')
            })
        })
        .unwrap_or(false)
}

#[cfg(windows)]
fn is_filesystem_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_filesystem_reparse_point(_metadata: &fs::Metadata) -> bool { false }

#[tauri::command]
fn sha256_text(value: String) -> String { format!("{:x}", Sha256::digest(value.as_bytes())) }


#[tauri::command]
async fn read_nfo_text(path: String) -> Result<String, String> {
    spawn_native_io("read_nfo_text", move || read_nfo_text_blocking(path)).await
}

fn read_nfo_text_blocking(path: String) -> Result<String, String> {
    let file = require_existing_file(&path)?;
    let extension = file.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if extension != "nfo" {
        return Err("只允许通过 NFO Reader 读取 .nfo 文件。".into());
    }
    let metadata = fs::metadata(&file).map_err(display_error)?;
    const MAX_NFO_BYTES: u64 = 10 * 1024 * 1024;
    if metadata.len() > MAX_NFO_BYTES {
        return Err("NFO 文件超过 10 MB 安全上限。".into());
    }
    fs::read_to_string(file).map_err(|error| format!("无法读取 NFO：{error}"))
}

#[tauri::command]
async fn import_private_asset_file(app: AppHandle, path: String) -> Result<DesktopImportedAssetFile, String> {
    spawn_native_io("import_private_asset_file", move || import_private_asset_file_blocking(app, path)).await
}

fn import_private_asset_file_blocking(app: AppHandle, path: String) -> Result<DesktopImportedAssetFile, String> {
    const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
    let source = require_existing_file(&path)?;
    let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    let (mime_type, canonical_extension) = match extension.as_str() {
        "jpg" | "jpeg" => ("image/jpeg", "jpg"),
        "png" => ("image/png", "png"),
        "webp" => ("image/webp", "webp"),
        "gif" => ("image/gif", "gif"),
        "avif" => ("image/avif", "avif"),
        _ => return Err("当前只允许导入 JPEG、PNG、WebP、GIF、AVIF 本地图片。".into()),
    };
    let metadata = fs::metadata(&source).map_err(display_error)?;
    if metadata.len() == 0 { return Err("图片文件为空。".into()); }
    if metadata.len() > MAX_IMAGE_BYTES { return Err("图片超过 25 MB 安全上限。".into()); }
    validate_image_signature(&source, canonical_extension)?;

    let sha256 = sha256_path(&source)?;
    let library_path = configured_private_library_path(&app)?;
    let directory = PathBuf::from(&library_path).join("asset-files");
    fs::create_dir_all(&directory).map_err(display_error)?;
    let file_name = format!("{sha256}.{canonical_extension}");
    let target = directory.join(&file_name);
    if !target.exists() {
        let temporary = directory.join(format!("{file_name}.tmp"));
        fs::copy(&source, &temporary).map_err(display_error)?;
        if target.exists() { fs::remove_file(&temporary).map_err(display_error)?; }
        else { fs::rename(&temporary, &target).map_err(display_error)?; }
    }

    Ok(DesktopImportedAssetFile {
        storage_path: format!("asset-files/{file_name}"),
        mime_type: mime_type.into(),
        file_size: metadata.len(),
        sha256,
    })
}

/// 只读取当前 Private Library 中已经登记到 asset-files/ 的图片。
///
/// 不开放任意路径读取，也不启用全盘 asset:// scope。前端只能提交 Asset.storagePath
/// 这类相对路径，Native Boundary 会重新绑定到当前 Settings 的 Private Library 并校验：
/// - 必须位于 asset-files/ 下；
/// - 禁止绝对路径和 .. 路径穿越；
/// - 只允许受支持图片扩展名；
/// - 单文件仍受 25 MB 上限约束。
///
/// 返回 tauri::ipc::Response 可避免 Vec<u8> 被 JSON 数组展开，适合海报缩略图。
#[tauri::command]
async fn read_private_asset_bytes(app: AppHandle, storage_path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = spawn_native_io("read_private_asset_bytes", move || read_private_asset_bytes_blocking(app, storage_path)).await?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn read_private_asset_bytes_blocking(app: AppHandle, storage_path: String) -> Result<Vec<u8>, String> {
    const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
    validate_text_path(&storage_path)?;
    let relative = Path::new(&storage_path);
    if relative.is_absolute() { return Err("Asset storagePath 必须是 Private Library 内的相对路径。".into()); }
    if relative.components().any(|component| matches!(component, std::path::Component::ParentDir)) {
        return Err("Asset storagePath 不能包含 .. 路径穿越。".into());
    }

    let library_path = configured_private_library_path(&app)?;
    let asset_root = normalize_lexical(&PathBuf::from(&library_path).join("asset-files"));
    let target = normalize_lexical(&PathBuf::from(&library_path).join(relative));
    if !target.starts_with(&asset_root) {
        return Err("只允许读取当前 Private Library 的 asset-files。".into());
    }

    // 再做一次真实文件系统 canonicalize，防止 asset-files 内的符号链接逃逸到资料库外。
    let canonical_root = fs::canonicalize(&asset_root).map_err(|error| format!("无法解析 Private asset-files：{error}"))?;
    let canonical_target = fs::canonicalize(&target).map_err(|error| format!("无法解析 Private Asset：{error}"))?;
    if !canonical_target.starts_with(&canonical_root) {
        return Err("Private Asset 真实路径越过了 asset-files 边界。".into());
    }

    let extension = canonical_target.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    let canonical_extension = match extension.as_str() {
        "jpg" | "jpeg" => "jpg",
        "png" => "png",
        "webp" => "webp",
        "gif" => "gif",
        "avif" => "avif",
        _ => return Err("当前只允许读取 JPEG、PNG、WebP、GIF、AVIF Private Asset。".into()),
    };
    let metadata = fs::metadata(&canonical_target).map_err(|error| format!("无法读取 Private Asset：{error}"))?;
    if !metadata.is_file() { return Err("Asset storagePath 不是普通文件。".into()); }
    if metadata.len() == 0 { return Err("Private Asset 文件为空。".into()); }
    if metadata.len() > MAX_IMAGE_BYTES { return Err("Private Asset 超过 25 MB 安全上限。".into()); }
    validate_image_signature(&canonical_target, canonical_extension)?;
    fs::read(canonical_target).map_err(display_error)
}

#[tauri::command]
async fn sha256_file(path: String) -> Result<String, String> {
    spawn_native_io("sha256_file", move || {
        let file_path = require_existing_file(&path)?;
        sha256_path(&file_path)
    }).await
}

fn sha256_path(file_path: &Path) -> Result<String, String> {
    let mut file = File::open(file_path).map_err(display_error)?;
    let mut digest = Sha256::new();
    // 不要在 Tauri / async worker 栈上放 1 MiB 固定数组。Windows GUI 主线程栈通常较小，
    // Asset Import 第一次进入 SHA-256 时就可能因为这块局部数组直接触发 STATUS_STACK_OVERFLOW。
    // 使用堆分配的 256 KiB 流式缓冲，吞吐足够，同时让栈占用保持常量级。
    let mut buffer = vec![0_u8; 256 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(display_error)?;
        if count == 0 { break; }
        digest.update(&buffer[..count]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn validate_image_signature(file_path: &Path, canonical_extension: &str) -> Result<(), String> {
    let mut file = File::open(file_path).map_err(display_error)?;
    let mut header = [0_u8; 32];
    let count = file.read(&mut header).map_err(display_error)?;
    let bytes = &header[..count];
    let valid = match canonical_extension {
        "jpg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "png" => bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
        "gif" => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        "webp" => bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        "avif" => bytes.len() >= 12
            && &bytes[4..8] == b"ftyp"
            && bytes[8..].windows(4).any(|brand| brand == b"avif" || brand == b"avis" || brand == b"mif1"),
        _ => false,
    };
    if valid { Ok(()) } else { Err("图片扩展名与实际文件格式不匹配，已拒绝导入。".into()) }
}


#[tauri::command]
fn inspect_shared_pack(pack_path: String) -> Result<DesktopSharedPackInfo, String> {
    validate_text_path(&pack_path)?;
    let configured = pack_path.trim().to_string();
    let requested = PathBuf::from(&configured);
    let absolute = if requested.is_absolute() {
        requested
    } else {
        std::env::current_dir().map_err(display_error)?.join(requested)
    };
    let absolute = normalize_lexical(&absolute);
    let manifest_path = absolute.join("localogue-pack.json");
    let library_path = absolute.join("library");

    let invalid = |message: String| DesktopSharedPackInfo {
        configured_path: configured.clone(),
        absolute_path: path_to_string(&absolute),
        library_path: None,
        valid: false,
        id: None,
        name: None,
        version: None,
        description: None,
        license: None,
        error: Some(message),
    };

    if !manifest_path.is_file() {
        return Ok(invalid("缺少 localogue-pack.json。".into()));
    }
    if !library_path.is_dir() {
        return Ok(invalid("缺少 library/ 目录。".into()));
    }

    let raw = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("无法读取 Shared Pack manifest：{error}"))?;
    let manifest: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析 Shared Pack manifest：{error}"))?;
    if manifest.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Ok(invalid("当前只支持 Shared Pack schemaVersion 1。".into()));
    }
    if manifest.get("kind").and_then(Value::as_str) != Some("shared-library") {
        return Ok(invalid("当前只支持 kind=shared-library。".into()));
    }

    let id = manifest.get("id").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty());
    let name = manifest.get("name").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty());
    let version = manifest.get("version").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty());
    if id.is_none() || name.is_none() || version.is_none() {
        return Ok(invalid("Shared Pack manifest 缺少 id / name / version。".into()));
    }

    Ok(DesktopSharedPackInfo {
        configured_path: configured,
        absolute_path: path_to_string(&absolute),
        library_path: Some(path_to_string(&library_path)),
        valid: true,
        id: id.map(str::to_string),
        name: name.map(str::to_string),
        version: version.map(str::to_string),
        description: manifest.get("description").and_then(Value::as_str).map(str::to_string),
        license: manifest.get("license").and_then(Value::as_str).map(str::to_string),
        error: None,
    })
}

#[tauri::command]
async fn read_library_collection(library_path: String, collection: String) -> Result<Vec<Value>, String> {
    spawn_native_io("read_library_collection", move || read_library_collection_blocking(library_path, collection)).await
}

fn read_library_collection_blocking(library_path: String, collection: String) -> Result<Vec<Value>, String> {
    let directory = safe_collection_directory(&library_path, &collection)?;
    if !directory.exists() { return Ok(Vec::new()); }
    let mut values = Vec::new();
    for item in fs::read_dir(directory).map_err(display_error)? {
        let path = item.map_err(display_error)?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") { continue; }
        let raw = fs::read_to_string(&path).map_err(display_error)?;
        values.push(serde_json::from_str(&raw).map_err(display_error)?);
    }
    Ok(values)
}

#[tauri::command]
async fn write_library_entity(app: AppHandle, collection: String, entity: Value) -> Result<(), String> {
    spawn_native_io("write_library_entity", move || write_library_entity_blocking(app, collection, entity)).await
}

fn write_library_entity_blocking(app: AppHandle, collection: String, entity: Value) -> Result<(), String> {
    validate_writable_entity(&collection, &entity)?;
    let id = entity.get("id").and_then(Value::as_str).ok_or_else(|| "实体缺少稳定 id。".to_string())?;
    if !is_safe_id(id) { return Err("实体 id 包含不安全字符。".into()); }

    // 写根目录不接受 Webview 传参。Native Boundary 永远从当前 Desktop Settings
    // 解析 Private Library，因而 Shared Pack 即使被挂载，也不能借用此命令写入。
    let library_path = configured_private_library_path(&app)?;
    let directory = safe_writable_collection_directory(&library_path, &collection)?;
    fs::create_dir_all(&directory).map_err(display_error)?;
    let target = directory.join(format!("{id}.json"));
    let temporary = directory.join(format!("{id}.json.tmp"));
    let body = serde_json::to_string_pretty(&entity).map_err(display_error)? + "\n";
    fs::write(&temporary, body).map_err(display_error)?;
    if target.exists() { fs::remove_file(&target).map_err(display_error)?; }
    fs::rename(temporary, target).map_err(display_error)
}

#[tauri::command]
async fn read_private_audit_collection(app: AppHandle, collection: String) -> Result<Vec<Value>, String> {
    spawn_native_io("read_private_audit_collection", move || {
        if !is_private_audit_collection(&collection) {
            return Err("Desktop Audit Reader 拒绝未授权集合。".into());
        }
        let library_path = configured_private_library_path(&app)?;
        read_json_objects(&PathBuf::from(library_path).join(collection))
    }).await
}

#[tauri::command]
async fn write_private_audit_entity(app: AppHandle, collection: String, entity: Value) -> Result<(), String> {
    spawn_native_io("write_private_audit_entity", move || write_private_audit_entity_blocking(app, collection, entity)).await
}

fn write_private_audit_entity_blocking(app: AppHandle, collection: String, entity: Value) -> Result<(), String> {
    if !is_private_audit_collection(&collection) {
        return Err("Desktop Audit Writer 拒绝未授权集合。".into());
    }
    validate_private_audit_entity(&collection, &entity)?;
    let id = entity.get("id").and_then(Value::as_str).ok_or_else(|| "审计实体缺少稳定 id。".to_string())?;
    if !is_safe_id(id) { return Err("审计实体 id 包含不安全字符。".into()); }
    let library_path = configured_private_library_path(&app)?;
    atomic_write_json(&PathBuf::from(library_path).join(&collection), id, &entity)
}

#[tauri::command]
async fn read_private_presentation_preferences(app: AppHandle) -> Result<Vec<Value>, String> {
    spawn_native_io("read_private_presentation_preferences", move || {
        let library_path = configured_private_library_path(&app)?;
        read_json_objects(&PathBuf::from(library_path).join("presentation-preferences"))
    }).await
}

#[tauri::command]
async fn write_private_presentation_preference(app: AppHandle, entity: Value) -> Result<(), String> {
    spawn_native_io("write_private_presentation_preference", move || {
        validate_presentation_preference(&entity)?;
        let id = entity.get("id").and_then(Value::as_str).ok_or_else(|| "Presentation Preference 缺少稳定 id。".to_string())?;
        if !is_safe_id(id) { return Err("Presentation Preference id 包含不安全字符。".into()); }
        let library_path = configured_private_library_path(&app)?;
        atomic_write_json(&PathBuf::from(library_path).join("presentation-preferences"), id, &entity)
    }).await
}

#[tauri::command]
async fn create_governance_snapshot(app: AppHandle, plan: Value) -> Result<Value, String> {
    spawn_native_io("create_governance_snapshot", move || create_governance_snapshot_blocking(app, plan)).await
}

fn create_governance_snapshot_blocking(app: AppHandle, plan: Value) -> Result<Value, String> {
    let root = PathBuf::from(configured_private_library_path(&app)?);
    let evidence_id = plan.get("evidenceId").and_then(Value::as_str).ok_or_else(|| "Commit Plan 缺少 evidenceId。".to_string())?;
    let work_id = plan.get("targetWorkId").and_then(Value::as_str).ok_or_else(|| "Commit Plan 缺少 targetWorkId。".to_string())?;
    let work_code = plan.get("targetWorkCode").and_then(Value::as_str).ok_or_else(|| "Commit Plan 缺少 targetWorkCode。".to_string())?;
    let fingerprint = plan.get("fingerprint").and_then(Value::as_str).ok_or_else(|| "Commit Plan 缺少 fingerprint。".to_string())?;
    for value in [evidence_id, work_id] { if !is_safe_id(value) { return Err("Commit Plan 包含不安全实体 id。".into()); } }

    let mut relative_paths = HashSet::new();
    if let Some(operations) = plan.get("operations").and_then(Value::as_array) {
        for operation in operations {
            let kind = operation.get("kind").and_then(Value::as_str).unwrap_or("");
            let entity_id = operation.get("entityId").and_then(Value::as_str).unwrap_or("");
            if !is_safe_id(entity_id) { return Err("Commit Operation 包含不安全 entityId。".into()); }
            let collection = match kind {
                "create_person" => Some("people"),
                "create_organization" => Some("organizations"),
                "create_series" => Some("series"),
                "create_genre" => Some("genres"),
                "create_tag" => Some("tags"),
                "create_work" | "update_work" => Some("works"),
                _ => None,
            };
            if let Some(collection) = collection { relative_paths.insert(format!("{collection}/{entity_id}.json")); }
        }
    }
    relative_paths.insert(format!("provenance/{work_id}.json"));
    relative_paths.insert(format!("evidence-lifecycle/{evidence_id}.json"));

    let mut paths: Vec<String> = relative_paths.into_iter().collect();
    paths.sort();
    let mut entries = Vec::new();
    for relative_path in paths {
        let absolute = safe_governance_relative_path(&root, &relative_path)?;
        match fs::read_to_string(&absolute) {
            Ok(content) => entries.push(serde_json::json!({"relativePath": relative_path, "existed": true, "content": content})),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => entries.push(serde_json::json!({"relativePath": relative_path, "existed": false})),
            Err(error) => return Err(display_error(error)),
        }
    }
    let id = format!("snapshot_{}", now_marker());
    let snapshot = serde_json::json!({
        "schemaVersion": 1,
        "id": id,
        "createdAt": plan.get("generatedAt").and_then(Value::as_str).unwrap_or(""),
        "evidenceId": evidence_id,
        "targetWorkId": work_id,
        "targetWorkCode": work_code,
        "fingerprint": fingerprint,
        "entries": entries,
    });
    atomic_write_json(&root.join("snapshots"), snapshot.get("id").and_then(Value::as_str).unwrap_or("snapshot"), &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
async fn restore_governance_snapshot(app: AppHandle, snapshot_id: String) -> Result<usize, String> {
    spawn_native_io("restore_governance_snapshot", move || restore_governance_snapshot_blocking(app, snapshot_id)).await
}

fn restore_governance_snapshot_blocking(app: AppHandle, snapshot_id: String) -> Result<usize, String> {
    if !is_safe_id(&snapshot_id) { return Err("Snapshot id 不安全。".into()); }
    let root = PathBuf::from(configured_private_library_path(&app)?);
    let path = root.join("snapshots").join(format!("{snapshot_id}.json"));
    let snapshot: Value = serde_json::from_str(&fs::read_to_string(path).map_err(display_error)?).map_err(display_error)?;
    let entries = snapshot.get("entries").and_then(Value::as_array).ok_or_else(|| "Snapshot 缺少 entries。".to_string())?;
    for entry in entries {
        let relative = entry.get("relativePath").and_then(Value::as_str).ok_or_else(|| "Snapshot entry 缺少 relativePath。".to_string())?;
        let target = safe_governance_relative_path(&root, relative)?;
        let existed = entry.get("existed").and_then(Value::as_bool).unwrap_or(false);
        if !existed {
            if target.exists() { fs::remove_file(&target).map_err(display_error)?; }
            continue;
        }
        let content = entry.get("content").and_then(Value::as_str).ok_or_else(|| "Snapshot entry 缺少 content。".to_string())?;
        if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(display_error)?; }
        let temporary = target.with_extension("json.restore.tmp");
        fs::write(&temporary, content).map_err(display_error)?;
        if target.exists() { fs::remove_file(&target).map_err(display_error)?; }
        fs::rename(temporary, target).map_err(display_error)?;
    }
    Ok(entries.len())
}

fn is_private_audit_collection(collection: &str) -> bool {
    matches!(collection, "evidence" | "evidence-lifecycle" | "review-commits" | "snapshots" | "restore-receipts" | "provenance" | "media-binding-receipts")
}

fn atomic_write_json(directory: &Path, id: &str, entity: &Value) -> Result<(), String> {
    fs::create_dir_all(directory).map_err(display_error)?;
    let target = directory.join(format!("{id}.json"));
    let temporary = directory.join(format!("{id}.json.tmp"));
    let body = serde_json::to_string_pretty(entity).map_err(display_error)? + "\n";
    fs::write(&temporary, body).map_err(display_error)?;
    if target.exists() { fs::remove_file(&target).map_err(display_error)?; }
    fs::rename(temporary, target).map_err(display_error)
}

fn safe_governance_relative_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let normalized = relative.replace('\\', "/");
    let mut parts = normalized.split('/');
    let collection = parts.next().unwrap_or("");
    let file = parts.next().unwrap_or("");
    if parts.next().is_some() || !matches!(collection, "works" | "people" | "organizations" | "series" | "genres" | "tags" | "provenance" | "evidence-lifecycle") {
        return Err(format!("Snapshot 路径不在治理白名单：{relative}"));
    }
    if !file.ends_with(".json") { return Err(format!("Snapshot 路径不是 JSON：{relative}")); }
    let id = file.trim_end_matches(".json");
    if !is_safe_id(id) { return Err(format!("Snapshot 文件名不安全：{relative}")); }
    Ok(root.join(collection).join(file))
}

#[tauri::command]
async fn delete_library_entity(app: AppHandle, collection: String, id: String) -> Result<(), String> {
    spawn_native_io("delete_library_entity", move || delete_library_entity_blocking(app, collection, id)).await
}

fn delete_library_entity_blocking(app: AppHandle, collection: String, id: String) -> Result<(), String> {
    if !matches!(collection.as_str(), "works" | "people" | "genres" | "tags" | "assets" | "media-files") {
        return Err("Desktop 删除只开放受引用保护的 works / people / genres / tags / assets / media-files。".into());
    }
    if !is_safe_id(&id) { return Err("实体 id 包含不安全字符。".into()); }
    let library_path = configured_private_library_path(&app)?;
    ensure_private_delete_is_unreferenced(&library_path, &collection, &id)?;
    let target = safe_writable_collection_directory(&library_path, &collection)?.join(format!("{id}.json"));
    if target.exists() { fs::remove_file(target).map_err(display_error)?; }
    Ok(())
}

fn ensure_private_delete_is_unreferenced(library_path: &str, collection: &str, id: &str) -> Result<(), String> {
    if collection == "media-files" { return Ok(()); }

    let works = read_json_objects(&PathBuf::from(library_path).join("works"))?;
    if collection == "people" {
        for work in &works {
            let referenced = work.get("personRelations").and_then(Value::as_array).map(|relations| {
                relations.iter().any(|relation| relation.get("personId").and_then(Value::as_str) == Some(id))
            }).unwrap_or(false);
            if referenced {
                return Err("人物仍被 Private Work 引用；请先在作品编辑中移除人物关系。".into());
            }
        }
        let assets = read_json_objects(&PathBuf::from(library_path).join("assets"))?;
        if assets.iter().any(|item| item.get("subjectType").and_then(Value::as_str) == Some("person") && item.get("subjectId").and_then(Value::as_str) == Some(id)) {
            return Err("Person 仍有 Private Asset 引用；请先移除人物图片资产。".into());
        }
    }

    if collection == "works" {
        let media = read_json_objects(&PathBuf::from(library_path).join("media-files"))?;
        if media.iter().any(|item| item.get("workId").and_then(Value::as_str) == Some(id)) {
            return Err("Work 仍有 Private MediaFile 绑定；请先解除媒体关联。".into());
        }
        let assets = read_json_objects(&PathBuf::from(library_path).join("assets"))?;
        if assets.iter().any(|item| item.get("subjectType").and_then(Value::as_str) == Some("work") && item.get("subjectId").and_then(Value::as_str) == Some(id)) {
            return Err("Work 仍有 Private Asset 引用；请先移除本地图片资产。".into());
        }
    }

    if collection == "genres" || collection == "tags" {
        let field = if collection == "genres" { "genreIds" } else { "tagIds" };
        for work in &works {
            let referenced = work.get(field).and_then(Value::as_array).map(|values| values.iter().any(|value| value.as_str() == Some(id))).unwrap_or(false);
            if referenced {
                return Err(format!("{} 仍被 Private Work 引用；请先完成分类修复或在作品编辑中解除引用。", if collection == "genres" { "Genre" } else { "Tag" }));
            }
        }
    }

    if collection == "assets" {
        for work in &works {
            let referenced = work.get("assetIds").and_then(Value::as_array).map(|values| values.iter().any(|value| value.as_str() == Some(id))).unwrap_or(false);
            if referenced { return Err("Asset 仍被 Private Work 引用；请先从 Work.assetIds 移除。".into()); }
        }
        let people = read_json_objects(&PathBuf::from(library_path).join("people"))?;
        for person in &people {
            let portrait = person.get("portraitAssetId").and_then(Value::as_str) == Some(id);
            let gallery = person.get("galleryAssetIds").and_then(Value::as_array).map(|values| values.iter().any(|value| value.as_str() == Some(id))).unwrap_or(false);
            if portrait || gallery { return Err("Asset 仍被 Private Person 引用；请先移除人物图片引用。".into()); }
        }
        let preferences = read_json_objects(&PathBuf::from(library_path).join("presentation-preferences"))?;
        if preferences.iter().any(|item| {
            item.get("preferredPortraitAssetId").and_then(Value::as_str) == Some(id)
                || item.get("preferredCoverAssetId").and_then(Value::as_str) == Some(id)
        }) {
            return Err("Asset 仍被 Presentation Preference 引用；请先恢复默认展示图片。".into());
        }
    }
    Ok(())
}

fn read_json_objects(directory: &Path) -> Result<Vec<Value>, String> {
    if !directory.exists() { return Ok(Vec::new()); }
    let mut output = Vec::new();
    for entry in fs::read_dir(directory).map_err(display_error)? {
        let path = entry.map_err(display_error)?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") { continue; }
        let text = fs::read_to_string(&path).map_err(display_error)?;
        if let Ok(value) = serde_json::from_str::<Value>(&text) {
            if value.is_object() { output.push(value); }
        }
    }
    Ok(output)
}

async fn spawn_native_io<T, F>(label: &'static str, operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let sequence = NATIVE_IO_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    eprintln!("[Localogue Desktop] native_io #{sequence} {label} queued");
    let joined = tauri::async_runtime::spawn_blocking(move || {
        eprintln!(
            "[Localogue Desktop] native_io #{sequence} {label} start worker={:?}",
            std::thread::current().id()
        );
        let result = operation();
        eprintln!(
            "[Localogue Desktop] native_io #{sequence} {label} {} worker={:?}",
            if result.is_ok() { "ok" } else { "error" },
            std::thread::current().id()
        );
        result
    })
    .await
    .map_err(|error| format!("Native I/O 后台任务 {label} 异常结束：{error}"))?;
    joined
}

fn emit_progress(app: &AppHandle, task_id: &str, stage: &'static str, message: &str, current_path: Option<&str>) {
    let _ = app.emit(PROGRESS_EVENT, DesktopTaskProgress {
        task_id: task_id.into(),
        task_type: "media-probe",
        stage,
        message: message.into(),
        current_path: current_path.map(str::to_string),
    });
}


fn configured_private_library_path(app: &AppHandle) -> Result<String, String> {
    let settings = load_desktop_settings(app.clone())?;
    settings.library_path.ok_or_else(|| "当前没有配置 Private Library；Shared Pack 永远只读。".to_string())
}

fn desktop_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map(|path| path.join(SETTINGS_FILE)).map_err(display_error)
}

fn normalize_settings(mut value: DesktopBootstrapSettings) -> Result<DesktopBootstrapSettings, String> {
    value.schema_version = 1;
    value.library_path = clean_optional_path(value.library_path)?;
    value.ffprobe_path = clean_optional_path(value.ffprobe_path)?;
    value.library_roots = unique_clean_paths(value.library_roots)?;
    value.media_scan_paths = unique_clean_paths(value.media_scan_paths)?;
    value.nfo_scan_paths = unique_clean_paths(value.nfo_scan_paths)?;
    value.shared_pack_paths = unique_clean_paths(value.shared_pack_paths)?;
    let web_url = value.web_url.trim();
    value.web_url = if web_url.is_empty() { "http://127.0.0.1:3000".into() } else { web_url.into() };
    Ok(value)
}

fn clean_optional_path(value: Option<String>) -> Result<Option<String>, String> {
    match value {
        None => Ok(None),
        Some(raw) => {
            let trimmed = raw.trim();
            validate_text_path(trimmed)?;
            Ok((!trimmed.is_empty()).then(|| trimmed.to_string()))
        }
    }
}

fn unique_clean_paths(values: Vec<String>) -> Result<Vec<String>, String> {
    let mut output = Vec::new();
    for raw in values {
        let trimmed = raw.trim();
        validate_text_path(trimmed)?;
        if !trimmed.is_empty() && !output.iter().any(|item| item == trimmed) {
            output.push(trimmed.to_string());
        }
    }
    Ok(output)
}

fn validate_text_path(value: &str) -> Result<(), String> {
    if value.contains('\0') { return Err("路径不能包含 NUL 字符。".into()); }
    if value.len() > 4096 { return Err("路径过长。".into()); }
    Ok(())
}

fn require_existing_path(value: String) -> Result<PathBuf, String> {
    validate_text_path(&value)?;
    let path = PathBuf::from(value);
    if !path.exists() { return Err("目标路径不存在。".into()); }
    Ok(path)
}

fn require_existing_file(value: &str) -> Result<PathBuf, String> {
    validate_text_path(value)?;
    let path = PathBuf::from(value);
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取媒体文件：{error}"))?;
    if !metadata.is_file() { return Err("目标不是普通文件。".into()); }
    Ok(path)
}

fn require_safe_media_extension(path: &Path) -> Result<(), String> {
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if !SAFE_MEDIA_EXTENSIONS.contains(&extension.as_str()) {
        return Err("V1-13 Desktop Alpha 的“默认程序打开”只允许受支持的视频文件，避免把通用路径打开能力演变成任意程序执行入口。".into());
    }
    Ok(())
}

fn validate_ffprobe_executable(value: &str) -> Result<&str, String> {
    let trimmed = value.trim();
    validate_text_path(trimmed)?;
    let name = Path::new(trimmed).file_name().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if name != "ffprobe" && name != "ffprobe.exe" {
        return Err("为降低 Desktop Webview 被滥用执行任意程序的风险，V1-13 只允许调用名为 ffprobe / ffprobe.exe 的可执行文件。".into());
    }
    Ok(trimmed)
}

fn resolve_ffprobe_executable(value: &str) -> Result<PathBuf, String> {
    let validated = validate_ffprobe_executable(value)?;
    let requested = PathBuf::from(validated);
    if requested.components().count() > 1 { return Ok(requested); }

    // Release 包可把 target-triple ffprobe 放到主程序旁的 resources/bin。
    // 没有随包二进制时继续回退 PATH，开发环境和发行包使用同一安全白名单。
    if let Ok(current) = std::env::current_exe() {
        let binary = if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" };
        if let Some(parent) = current.parent() {
            for candidate in [parent.join("resources").join("bin").join(binary), parent.join(binary)] {
                if candidate.is_file() { return Ok(candidate); }
            }
        }
    }
    Ok(requested)
}

fn safe_collection_directory(root: &str, collection: &str) -> Result<PathBuf, String> {
    validate_text_path(root)?;
    if !matches!(
        collection,
        "works" | "people" | "organizations" | "series" | "genres" | "tags" | "assets" | "media-files"
    ) {
        return Err("Desktop Library 只允许访问明确白名单中的资料集合。".into());
    }
    Ok(PathBuf::from(root).join(collection))
}

fn validate_writable_entity(collection: &str, entity: &Value) -> Result<(), String> {
    if !entity.is_object() { return Err("写入实体必须是 JSON 对象。".into()); }
    let require_string = |field: &str| -> Result<(), String> {
        if entity.get(field).and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).is_none() {
            return Err(format!("{collection} 实体缺少字符串字段 {field}。"));
        }
        Ok(())
    };
    let require_array = |field: &str| -> Result<(), String> {
        if !entity.get(field).map(Value::is_array).unwrap_or(false) {
            return Err(format!("{collection} 实体缺少数组字段 {field}。"));
        }
        Ok(())
    };

    require_string("id")?;
    match collection {
        "works" => { require_string("code")?; require_array("personRelations")?; require_array("seriesIds")?; require_array("genreIds")?; require_array("tagIds")?; },
        "people" => { require_array("names")?; require_array("careerEvents")?; require_array("galleryAssetIds")?; },
        "organizations" => { require_string("kind")?; if !entity.get("names").map(Value::is_object).unwrap_or(false) { return Err("organizations 实体缺少 names 对象。".into()); } },
        "series" | "genres" | "tags" => { if !entity.get("names").map(Value::is_object).unwrap_or(false) { return Err(format!("{collection} 实体缺少 names 对象。")); } },
        "assets" => { require_string("type")?; require_string("storagePath")?; },
        "media-files" => { require_string("path")?; require_string("fileName")?; },
        _ => return Err("当前集合不允许通过 Desktop 写入。".into()),
    }
    Ok(())
}

fn validate_private_audit_entity(collection: &str, entity: &Value) -> Result<(), String> {
    if !is_private_audit_collection(collection) || !entity.is_object() {
        return Err("无效的 Desktop Private Audit 实体。".into());
    }
    let require = |field: &str| -> Result<(), String> {
        if entity.get(field).and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).is_none() {
            return Err(format!("{collection} 缺少字符串字段 {field}。"));
        }
        Ok(())
    };
    require("id")?;
    match collection {
        "evidence" => { require("sourceType")?; require("sourceName")?; require("importedAt")?; },
        "evidence-lifecycle" => { require("evidenceId")?; require("status")?; require("updatedAt")?; },
        "review-commits" => { require("evidenceId")?; require("committedAt")?; require("fingerprint")?; require("targetWorkId")?; require("targetWorkCode")?; },
        "snapshots" => { require("createdAt")?; require("evidenceId")?; require("targetWorkId")?; require("fingerprint")?; if !entity.get("entries").map(Value::is_array).unwrap_or(false) { return Err("snapshots 缺少 entries。".into()); } },
        "restore-receipts" => { require("commitReceiptId")?; require("snapshotId")?; require("targetWorkId")?; require("restoredAt")?; },
        "provenance" => { require("workId")?; if !entity.get("events").map(Value::is_array).unwrap_or(false) { return Err("provenance 缺少 events。".into()); } },
        "media-binding-receipts" => {
            for field in ["mediaFileId", "mediaFilePath", "action", "changedAt"] { require(field)?; }
            let action = entity.get("action").and_then(Value::as_str).unwrap_or("");
            if !matches!(action, "bind" | "rebind" | "unbind") { return Err("media-binding-receipts.action 无效。".into()); }
        },
        _ => return Err("无效的 Desktop Private Audit 集合。".into()),
    }
    Ok(())
}

fn validate_presentation_preference(entity: &Value) -> Result<(), String> {
    if !entity.is_object() { return Err("Presentation Preference 必须是 JSON 对象。".into()); }
    let require = |field: &str| -> Result<(), String> {
        if entity.get(field).and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).is_none() {
            return Err(format!("Presentation Preference 缺少字符串字段 {field}。"));
        }
        Ok(())
    };
    for field in ["id", "entityType", "entityId", "updatedAt"] { require(field)?; }
    let entity_type = entity.get("entityType").and_then(Value::as_str).unwrap_or("");
    if !matches!(entity_type, "person" | "work") { return Err("Presentation Preference entityType 无效。".into()); }
    if entity_type == "person" && entity.get("preferredCoverAssetId").and_then(Value::as_str).is_some() {
        return Err("Person Presentation Preference 不能写 preferredCoverAssetId。".into());
    }
    if entity_type == "work" && entity.get("preferredPortraitAssetId").and_then(Value::as_str).is_some() {
        return Err("Work Presentation Preference 不能写 preferredPortraitAssetId。".into());
    }
    Ok(())
}

fn safe_writable_collection_directory(root: &str, collection: &str) -> Result<PathBuf, String> {
    validate_text_path(root)?;
    if !matches!(collection, "works" | "people" | "organizations" | "series" | "genres" | "tags" | "assets" | "media-files") {
        return Err("V1-18 Desktop 只允许写入明确白名单中的 Private Canonical / assets / media-files 集合。".into());
    }
    Ok(PathBuf::from(root).join(collection))
}

fn is_safe_id(value: &str) -> bool { !value.is_empty() && value.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') }

fn modified_marker(metadata: &fs::Metadata) -> Result<String, String> {
    let millis = metadata.modified().map_err(display_error)?.duration_since(UNIX_EPOCH).map_err(display_error)?.as_millis();
    Ok(millis.to_string())
}

fn normalize_lexical(path: &Path) -> PathBuf {
    use std::path::Component;
    let mut result = PathBuf::new();
    for component in path.components() {
        match component { Component::CurDir => {}, Component::ParentDir => { result.pop(); }, other => result.push(other.as_os_str()) }
    }
    result
}

fn path_to_string(path: &Path) -> String { path.to_string_lossy().into_owned() }
fn display_error(error: impl std::fmt::Display) -> String { error.to_string() }
fn now_marker() -> String {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_millis().to_string()).unwrap_or_else(|_| "0".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            load_desktop_settings,
            save_desktop_settings,
            pick_directory,
            pick_media_file,
            pick_portable_pack_file,
            read_portable_pack_file,
            save_portable_pack_file,
            collect_private_portable_files,
            import_private_portable_files,
            collect_shared_portable_files,
            install_shared_portable_files,
            open_path,
            reveal_in_folder,
            open_web_url,
            probe_media,
            resolve_path,
            stat_path,
            path_exists,
            walk_files,
            read_nfo_text,
            import_private_asset_file,
            read_private_asset_bytes,
            sha256_text,
            sha256_file,
            inspect_shared_pack,
            read_library_collection,
            write_library_entity,
            read_private_audit_collection,
            write_private_audit_entity,
            read_private_presentation_preferences,
            write_private_presentation_preference,
            create_governance_snapshot,
            restore_governance_snapshot,
            delete_library_entity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Localogue Desktop");
}
