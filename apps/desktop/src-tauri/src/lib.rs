use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use url::Url;
use walkdir::WalkDir;

const PROGRESS_EVENT: &str = "localogue://desktop-task-progress";
const SETTINGS_FILE: &str = "desktop-settings.json";
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
    media_scan_paths: Vec<String>,
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
            media_scan_paths: Vec::new(),
            shared_pack_paths: Vec::new(),
            ffprobe_path: None,
            web_url: "http://127.0.0.1:3000".into(),
            updated_at: None,
        }
    }
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

    let output = Command::new(&executable)
        .args([
            "-v", "error",
            "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,width,height",
            "-of", "json",
        ])
        .arg(&file_path)
        .output()
        .map_err(|error| {
            emit_progress(&app, &task_id, "failed", &format!("ffprobe 启动失败：{error}"), Some(&request.file_path));
            format!("无法启动 ffprobe：{error}")
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
fn stat_path(path: String) -> Result<DesktopFileStat, String> {
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
fn path_exists(path: String) -> Result<bool, String> {
    validate_text_path(&path)?;
    Ok(Path::new(&path).exists())
}

#[tauri::command]
fn walk_files(request: WalkFilesRequest) -> Result<Vec<DesktopFileEntry>, String> {
    let root = PathBuf::from(&request.root);
    validate_text_path(&request.root)?;
    if !root.is_dir() { return Err("媒体扫描根路径不是可读取目录。".into()); }
    let allowed: HashSet<String> = request.extensions.into_iter()
        .map(|value| value.trim_start_matches('.').to_ascii_lowercase()).collect();
    let limit = request.max_files.unwrap_or(25_000).min(25_000);
    let mut output = Vec::new();
    for item in WalkDir::new(&root).follow_links(false).into_iter().filter_map(Result::ok) {
        if output.len() >= limit { break; }
        if !item.file_type().is_file() { continue; }
        let path = item.path();
        let has_hidden_component = path.strip_prefix(&root).ok()
            .map(|relative| relative.components().any(|part| part.as_os_str().to_string_lossy().starts_with('.')))
            .unwrap_or(false);
        if !request.include_hidden && has_hidden_component { continue; }
        let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
        if !allowed.is_empty() && !allowed.contains(&extension) { continue; }
        let metadata = item.metadata().map_err(display_error)?;
        output.push(DesktopFileEntry {
            path: path_to_string(path),
            name: item.file_name().to_string_lossy().into_owned(),
            extension: format!(".{extension}"),
            size: metadata.len(),
            modified_at: modified_marker(&metadata)?,
        });
    }
    Ok(output)
}

#[tauri::command]
fn sha256_text(value: String) -> String { format!("{:x}", Sha256::digest(value.as_bytes())) }

#[tauri::command]
fn sha256_file(path: String) -> Result<String, String> {
    let file_path = require_existing_file(&path)?;
    let mut file = File::open(file_path).map_err(display_error)?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(display_error)?;
        if count == 0 { break; }
        digest.update(&buffer[..count]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

#[tauri::command]
fn read_library_collection(library_path: String, collection: String) -> Result<Vec<Value>, String> {
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
fn write_library_entity(library_path: String, collection: String, entity: Value) -> Result<(), String> {
    let id = entity.get("id").and_then(Value::as_str).ok_or_else(|| "实体缺少稳定 id。".to_string())?;
    if !is_safe_id(id) { return Err("实体 id 包含不安全字符。".into()); }
    let directory = safe_collection_directory(&library_path, &collection)?;
    fs::create_dir_all(&directory).map_err(display_error)?;
    let target = directory.join(format!("{id}.json"));
    let temporary = directory.join(format!("{id}.json.tmp"));
    let body = serde_json::to_string_pretty(&entity).map_err(display_error)? + "\n";
    fs::write(&temporary, body).map_err(display_error)?;
    if target.exists() { fs::remove_file(&target).map_err(display_error)?; }
    fs::rename(temporary, target).map_err(display_error)
}

#[tauri::command]
fn delete_library_entity(library_path: String, collection: String, id: String) -> Result<(), String> {
    if !is_safe_id(&id) { return Err("实体 id 包含不安全字符。".into()); }
    let target = safe_collection_directory(&library_path, &collection)?.join(format!("{id}.json"));
    if target.exists() { fs::remove_file(target).map_err(display_error)?; }
    Ok(())
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

fn desktop_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map(|path| path.join(SETTINGS_FILE)).map_err(display_error)
}

fn normalize_settings(mut value: DesktopBootstrapSettings) -> Result<DesktopBootstrapSettings, String> {
    value.schema_version = 1;
    value.library_path = clean_optional_path(value.library_path)?;
    value.ffprobe_path = clean_optional_path(value.ffprobe_path)?;
    value.media_scan_paths = unique_clean_paths(value.media_scan_paths)?;
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
    if !matches!(collection, "works" | "media-files") { return Err("Desktop Scan 只允许访问 works / media-files 集合。".into()); }
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
            open_path,
            reveal_in_folder,
            open_web_url,
            probe_media,
            resolve_path,
            stat_path,
            path_exists,
            walk_files,
            sha256_text,
            sha256_file,
            read_library_collection,
            write_library_entity,
            delete_library_entity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Localogue Desktop");
}
