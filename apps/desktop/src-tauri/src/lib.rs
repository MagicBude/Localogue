use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet, VecDeque},
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
const PERSONAL_PORTABLE_DIRECTORIES: &[&str] = &[
    "works", "people", "organizations", "series", "genres", "tags", "assets", "asset-files",
    "presentation-preferences", "evidence", "evidence-lifecycle", "review-commits", "snapshots",
    "restore-receipts", "provenance", "person-edits", "media-binding-receipts",
];
static NATIVE_IO_SEQUENCE: AtomicU64 = AtomicU64::new(1);
const SAFE_MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "m4v", "ts", "mts", "m2ts", "webm", "flv",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopExampleLibraryInfo {
    library_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    shared_pack_path: Option<String>,
    created: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeInfo {
    runtime: &'static str,
    product_name: String,
    version: String,
    identifier: String,
    environment: &'static str,
    contract_revision: u16,
    app_config_dir: String,
    app_local_data_dir: String,
    settings_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLibraryProfile {
    id: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
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
    created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
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
    #[serde(default)]
    library_profiles: Vec<DesktopLibraryProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    active_library_profile_id: Option<String>,
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
            library_profiles: Vec::new(),
            active_library_profile_id: None,
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


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAssetStorageEntry {
    storage_path: String,
    file_size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAssetStorageHealth {
    asset_records: usize,
    managed_references: usize,
    stored_files: usize,
    orphan_files: Vec<DesktopAssetStorageEntry>,
    missing_files: Vec<String>,
    unmanaged_references: Vec<String>,
    reclaimable_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAssetStorageCleanupResult {
    deleted_files: usize,
    reclaimed_bytes: u64,
    skipped_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPortableFile {
    path: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPortableFileDigest {
    path: String,
    sha256: String,
    size: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPortableCategoryCount {
    new_files: u64,
    identical_files: u64,
    conflict_files: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPortablePlanEntry {
    path: String,
    category: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    existing_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPortablePrivatePreview {
    target_library_path: String,
    new_files: u64,
    identical_files: u64,
    conflict_files: u64,
    categories: BTreeMap<String, DesktopPortableCategoryCount>,
    entries: Vec<DesktopPortablePlanEntry>,
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
        contract_revision: 6,
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
fn provision_example_library(app: AppHandle) -> Result<DesktopExampleLibraryInfo, String> {
    let source_library = locate_example_resource(&app, "examples/dev-library/template")?;
    let source_shared_pack = locate_example_resource(&app, "examples/shared-packs/starter-community-pack")?;
    let local_data = app.path().app_local_data_dir().map_err(display_error)?;
    let library_destination = local_data.join("example-library");
    let shared_destination = local_data.join("example-shared-pack");

    // 示例库与配套 Shared Pack 都复制到 App Local Data，避免 Profile 指向开发仓库或
    // 安装包内部资源路径。内容签名发生变化时采用临时目录 + rename 原子刷新。
    let library_created = provision_resource_snapshot(
        &source_library,
        &library_destination,
        |path| example_library_is_complete(path),
    )?;
    provision_resource_snapshot(
        &source_shared_pack,
        &shared_destination,
        |path| path.join("localogue-pack.json").is_file() && path.join("library").is_dir(),
    )?;

    let shared_info = inspect_shared_pack(path_to_string(&shared_destination))?;
    if !shared_info.valid {
        return Err(format!(
            "内置示例 Shared Pack 刷新后校验失败：{}",
            shared_info.error.unwrap_or_else(|| "未知错误".into())
        ));
    }

    Ok(DesktopExampleLibraryInfo {
        library_path: path_to_string(&library_destination),
        shared_pack_path: Some(path_to_string(&shared_destination)),
        created: library_created,
    })
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
async fn pick_image_file(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Image", &["jpg", "jpeg", "png", "webp", "gif", "avif"])
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
        collect_portable_files(&root, PERSONAL_PORTABLE_DIRECTORIES)
    }).await
}

#[tauri::command]
async fn preview_private_portable_files(app: AppHandle, files: Vec<DesktopPortableFileDigest>) -> Result<DesktopPortablePrivatePreview, String> {
    spawn_native_io("preview_private_portable_files", move || {
        let root = PathBuf::from(configured_private_library_path(&app)?);
        preview_private_portable_files_at(&root, &files)
    }).await
}

#[tauri::command]
async fn import_private_portable_files(app: AppHandle, files: Vec<DesktopPortableFile>, expected_library_path: String) -> Result<Value, String> {
    spawn_native_io("import_private_portable_files", move || {
        let configured = configured_private_library_path(&app)?;
        if !same_library_path(&configured, &expected_library_path) {
            return Err("当前资料库已在预览后发生切换；为避免导入到错误资料库，请重新选择 Portable Pack 生成预览。".into());
        }
        let root = PathBuf::from(configured);
        let total_bytes = files.iter().try_fold(0_usize, |total, file| total.checked_add(file.bytes.len()).ok_or_else(|| "Portable Pack 大小溢出。".to_string()))?;
        if total_bytes > MAX_PORTABLE_PACK_BYTES { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }
        let mut imported = 0_u64;
        let mut skipped = 0_u64;
        let mut skipped_identical = 0_u64;
        let mut skipped_conflicts = 0_u64;
        let mut imported_by_category: BTreeMap<String, u64> = BTreeMap::new();
        let mut skipped_by_category: BTreeMap<String, u64> = BTreeMap::new();
        let mut created: Vec<PathBuf> = Vec::new();
        let result: Result<(), String> = (|| {
            for file in files {
                let target = safe_portable_relative_path(&root, &file.path, PERSONAL_PORTABLE_DIRECTORIES)?;
                ensure_portable_target_tree_is_safe(&root, &target)?;
                let category = portable_category(&file.path).to_string();
                if target.exists() {
                    skipped += 1;
                    *skipped_by_category.entry(category).or_default() += 1;
                    let incoming_sha256 = format!("{:x}", Sha256::digest(&file.bytes));
                    let identical = fs::metadata(&target).map(|meta| meta.is_file() && meta.len() == file.bytes.len() as u64).unwrap_or(false)
                        && sha256_path(&target).map(|value| value == incoming_sha256).unwrap_or(false);
                    if identical { skipped_identical += 1; } else { skipped_conflicts += 1; }
                    continue;
                }
                if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(display_error)?; }
                fs::write(&target, file.bytes).map_err(display_error)?;
                created.push(target);
                imported += 1;
                *imported_by_category.entry(category).or_default() += 1;
            }
            Ok(())
        })();
        if let Err(error) = result {
            for path in created.iter().rev() {
                let _ = fs::remove_file(path);
            }
            return Err(format!("Personal Portable Pack 导入失败，已回滚本次新建文件：{error}"));
        }
        Ok(serde_json::json!({
            "imported": imported,
            "skipped": skipped,
            "skippedIdentical": skipped_identical,
            "skippedConflicts": skipped_conflicts,
            "importedByCategory": imported_by_category,
            "skippedByCategory": skipped_by_category
        }))
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

fn preview_private_portable_files_at(root: &Path, files: &[DesktopPortableFileDigest]) -> Result<DesktopPortablePrivatePreview, String> {
    let total_size = files.iter().try_fold(0_u64, |total, file| total.checked_add(file.size).ok_or_else(|| "Portable Pack 大小溢出。".to_string()))?;
    if total_size > MAX_PORTABLE_PACK_BYTES as u64 { return Err("Portable Pack 超过 256 MB 安全上限。".into()); }

    let mut preview = DesktopPortablePrivatePreview {
        target_library_path: path_to_string(root),
        new_files: 0,
        identical_files: 0,
        conflict_files: 0,
        categories: BTreeMap::new(),
        entries: Vec::with_capacity(files.len()),
    };

    for file in files {
        if file.sha256.len() != 64 || !file.sha256.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(format!("{}: SHA-256 摘要格式无效。", file.path));
        }
        let target = safe_portable_relative_path(root, &file.path, PERSONAL_PORTABLE_DIRECTORIES)?;
        ensure_portable_target_tree_is_safe(root, &target)?;
        let category = portable_category(&file.path).to_string();
        let counts = preview.categories.entry(category.clone()).or_default();
        let metadata = fs::symlink_metadata(&target).ok();
        let (status, existing_size) = match metadata {
            None => {
                preview.new_files += 1;
                counts.new_files += 1;
                ("new".to_string(), None)
            }
            Some(meta) if meta.file_type().is_symlink() || !meta.is_file() => {
                preview.conflict_files += 1;
                counts.conflict_files += 1;
                ("conflict".to_string(), Some(meta.len()))
            }
            Some(meta) => {
                let identical = meta.len() == file.size
                    && sha256_path(&target).map(|digest| digest.eq_ignore_ascii_case(&file.sha256)).unwrap_or(false);
                if identical {
                    preview.identical_files += 1;
                    counts.identical_files += 1;
                    ("identical".to_string(), Some(meta.len()))
                } else {
                    preview.conflict_files += 1;
                    counts.conflict_files += 1;
                    ("conflict".to_string(), Some(meta.len()))
                }
            }
        };
        preview.entries.push(DesktopPortablePlanEntry { path: file.path.clone(), category, status, existing_size });
    }
    Ok(preview)
}

fn portable_category(path: &str) -> &'static str {
    match path.replace('\\', "/").split('/').next().unwrap_or("") {
        "works" | "people" | "organizations" | "series" | "genres" | "tags" => "canonical",
        "assets" => "assetMetadata",
        "asset-files" => "assetFiles",
        "presentation-preferences" => "presentation",
        _ => "audit",
    }
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

// Personal Portable Pack 只能写入 Private Library 自己管理的目录树。除了词法层面的
// `..` 白名单检查，还要阻止已有子目录通过 symlink / Windows reparse point 把写入
// 重定向到资料库之外。Private Library 根目录本身允许由用户放在 junction/挂载点上；
// 从根目录以下的每一个已存在组件开始检查。
fn ensure_portable_target_tree_is_safe(root: &Path, target: &Path) -> Result<(), String> {
    let relative = target
        .strip_prefix(root)
        .map_err(|_| "Portable 目标不属于当前 Private Library。".to_string())?;
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        cursor.push(component.as_os_str());
        let metadata = match fs::symlink_metadata(&cursor) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => return Err(display_error(error)),
        };
        if metadata.file_type().is_symlink() || is_filesystem_reparse_point(&metadata) {
            return Err(format!(
                "Portable 目标经过符号链接或 Reparse Point，已拒绝写入：{}",
                cursor.display()
            ));
        }
    }
    Ok(())
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
    let library_path = configured_private_library_path(&app)?;
    read_asset_bytes_from_root(Path::new(&library_path), &storage_path, "Private Asset")
}

/// 按当前 Repository 的 Private > Shared Pack 顺序解析 Asset.id 的真实来源，再读取该来源自己的 asset-files。
/// Webview 不能传任意 library root；Shared Pack 也必须先通过 localogue-pack.json 校验。
#[tauri::command]
async fn read_resolved_asset_bytes(app: AppHandle, asset_id: String, storage_path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = spawn_native_io("read_resolved_asset_bytes", move || read_resolved_asset_bytes_blocking(app, asset_id, storage_path)).await?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn read_resolved_asset_bytes_blocking(app: AppHandle, asset_id: String, storage_path: String) -> Result<Vec<u8>, String> {
    if !is_safe_id(&asset_id) { return Err("Asset id 包含不安全字符。".into()); }
    validate_text_path(&storage_path)?;
    let settings = load_desktop_settings(app)?;
    let mut roots = Vec::<PathBuf>::new();
    if let Some(private) = settings.library_path {
        roots.push(normalize_lexical(Path::new(&private)));
    }
    for configured in settings.shared_pack_paths {
        let info = inspect_shared_pack(configured)?;
        if info.valid {
            if let Some(library_path) = info.library_path {
                roots.push(normalize_lexical(Path::new(&library_path)));
            }
        }
    }

    for root in roots {
        let Some(record) = find_asset_record_at_root(&root, &asset_id)? else { continue; };
        let expected = record.get("storagePath").and_then(Value::as_str).ok_or_else(|| format!("Asset {asset_id} 缺少 storagePath。"))?;
        if expected.replace('\\', "/") != storage_path.replace('\\', "/") {
            // 同 ID 在高优先级来源中已经存在时，不允许 Webview 指定低优先级来源的 storagePath 绕过遮蔽规则。
            return Err(format!("Asset {asset_id} 的 storagePath 与当前最高优先级来源不一致。"));
        }
        return read_asset_bytes_from_root(&root, expected, "Resolved Asset");
    }
    Err(format!("当前 Private / Shared 资料源中找不到 Asset：{asset_id}"))
}

fn find_asset_record_at_root(root: &Path, asset_id: &str) -> Result<Option<Value>, String> {
    let directory = root.join("assets");
    if !directory.is_dir() { return Ok(None); }
    let direct = directory.join(format!("{asset_id}.json"));
    if direct.is_file() {
        let raw = fs::read_to_string(&direct).map_err(display_error)?;
        let value: Value = serde_json::from_str(&raw).map_err(display_error)?;
        if value.get("id").and_then(Value::as_str) == Some(asset_id) {
            return Ok(Some(value));
        }
        return Ok(None);
    }
    // Shared Pack 应按稳定 id 命名文件；这里保留兼容回退，避免旧 Pack 因文件名不同而无法显示。
    for value in read_json_objects(&directory)? {
        if value.get("id").and_then(Value::as_str) == Some(asset_id) { return Ok(Some(value)); }
    }
    Ok(None)
}

fn read_asset_bytes_from_root(library_root: &Path, storage_path: &str, label: &str) -> Result<Vec<u8>, String> {
    const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
    validate_text_path(storage_path)?;
    let relative = Path::new(storage_path);
    if relative.is_absolute() { return Err("Asset storagePath 必须是资料库内的相对路径。".into()); }
    if relative.components().any(|component| matches!(component, std::path::Component::ParentDir)) {
        return Err("Asset storagePath 不能包含 .. 路径穿越。".into());
    }

    let library_root = normalize_lexical(library_root);
    let asset_root = normalize_lexical(&library_root.join("asset-files"));
    let target = normalize_lexical(&library_root.join(relative));
    if !target.starts_with(&asset_root) {
        return Err(format!("{label} 只允许读取当前来源的 asset-files。"));
    }
    let canonical_root = fs::canonicalize(&asset_root).map_err(|error| format!("无法解析 {label} asset-files：{error}"))?;
    let canonical_target = fs::canonicalize(&target).map_err(|error| format!("无法解析 {label}：{error}"))?;
    if !canonical_target.starts_with(&canonical_root) {
        return Err(format!("{label} 真实路径越过了 asset-files 边界。"));
    }

    let extension = canonical_target.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    let canonical_extension = match extension.as_str() {
        "jpg" | "jpeg" => "jpg",
        "png" => "png",
        "webp" => "webp",
        "gif" => "gif",
        "avif" => "avif",
        _ => return Err("当前只允许读取 JPEG、PNG、WebP、GIF、AVIF Asset。".into()),
    };
    let metadata = fs::metadata(&canonical_target).map_err(|error| format!("无法读取 {label}：{error}"))?;
    if !metadata.is_file() { return Err("Asset storagePath 不是普通文件。".into()); }
    if metadata.len() == 0 { return Err(format!("{label} 文件为空。")); }
    if metadata.len() > MAX_IMAGE_BYTES { return Err(format!("{label} 超过 25 MB 安全上限。")); }
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

#[tauri::command]
async fn inspect_private_asset_storage(app: AppHandle) -> Result<DesktopAssetStorageHealth, String> {
    spawn_native_io("inspect_private_asset_storage", move || inspect_private_asset_storage_blocking(app)).await
}

fn inspect_private_asset_storage_blocking(app: AppHandle) -> Result<DesktopAssetStorageHealth, String> {
    let library_path = configured_private_library_path(&app)?;
    inspect_asset_storage_at(Path::new(&library_path))
}

#[tauri::command]
async fn cleanup_private_asset_orphans(app: AppHandle) -> Result<DesktopAssetStorageCleanupResult, String> {
    spawn_native_io("cleanup_private_asset_orphans", move || cleanup_private_asset_orphans_blocking(app)).await
}

fn cleanup_private_asset_orphans_blocking(app: AppHandle) -> Result<DesktopAssetStorageCleanupResult, String> {
    let library_path = configured_private_library_path(&app)?;
    cleanup_asset_orphans_at(Path::new(&library_path))
}

fn cleanup_asset_orphans_at(library_root: &Path) -> Result<DesktopAssetStorageCleanupResult, String> {
    let library_root = normalize_lexical(library_root);
    let asset_root = normalize_lexical(&library_root.join("asset-files"));
    let health = inspect_asset_storage_at(&library_root)?;
    if health.orphan_files.is_empty() {
        return Ok(DesktopAssetStorageCleanupResult { deleted_files: 0, reclaimed_bytes: 0, skipped_files: 0 });
    }

    if !asset_root.is_dir() {
        return Ok(DesktopAssetStorageCleanupResult { deleted_files: 0, reclaimed_bytes: 0, skipped_files: health.orphan_files.len() });
    }
    let canonical_root = fs::canonicalize(&asset_root).map_err(|error| format!("无法解析 Private asset-files：{error}"))?;
    let mut deleted_files = 0_usize;
    let mut reclaimed_bytes = 0_u64;
    let mut skipped_files = 0_usize;

    // 这里故意重新基于最新 Asset JSON 计算 orphan，再执行删除；不会相信 Webview 传入的路径列表。
    for orphan in health.orphan_files {
        let target = normalize_lexical(&library_root.join(&orphan.storage_path));
        if !target.starts_with(&asset_root) {
            skipped_files += 1;
            continue;
        }
        let metadata = match fs::symlink_metadata(&target) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                skipped_files += 1;
                continue;
            }
            Err(error) => return Err(format!("无法读取孤儿 Asset 文件 {}：{error}", target.display())),
        };
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            skipped_files += 1;
            continue;
        }
        let canonical_target = fs::canonicalize(&target).map_err(|error| format!("无法解析孤儿 Asset 文件 {}：{error}", target.display()))?;
        if !canonical_target.starts_with(&canonical_root) {
            skipped_files += 1;
            continue;
        }
        fs::remove_file(&canonical_target).map_err(|error| format!("无法删除孤儿 Asset 文件 {}：{error}", canonical_target.display()))?;
        deleted_files += 1;
        reclaimed_bytes = reclaimed_bytes.saturating_add(metadata.len());
    }

    Ok(DesktopAssetStorageCleanupResult { deleted_files, reclaimed_bytes, skipped_files })
}

fn inspect_asset_storage_at(library_root: &Path) -> Result<DesktopAssetStorageHealth, String> {
    let library_root = normalize_lexical(library_root);
    let asset_root = normalize_lexical(&library_root.join("asset-files"));
    let assets = read_json_objects(&library_root.join("assets"))?;
    let mut managed_targets = HashSet::<PathBuf>::new();
    let mut missing_files = Vec::<String>::new();
    let mut unmanaged = HashSet::<String>::new();

    for asset in &assets {
        let Some(storage_path) = asset.get("storagePath").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()) else { continue; };
        let raw = PathBuf::from(storage_path);
        let target = if raw.is_absolute() {
            normalize_lexical(&raw)
        } else {
            normalize_lexical(&library_root.join(&raw))
        };
        if !target.starts_with(&asset_root) {
            unmanaged.insert(storage_path.replace('\\', "/"));
            continue;
        }
        managed_targets.insert(target.clone());
        let is_safe_file = fs::symlink_metadata(&target)
            .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
            .unwrap_or(false);
        if !is_safe_file {
            missing_files.push(storage_path_from_library(&library_root, &target));
        }
    }

    let mut orphan_files = Vec::<DesktopAssetStorageEntry>::new();
    let mut stored_files = 0_usize;
    if asset_root.is_dir() {
        let mut queue = VecDeque::from([asset_root.clone()]);
        while let Some(directory) = queue.pop_front() {
            for entry in fs::read_dir(&directory).map_err(display_error)? {
                let entry = entry.map_err(display_error)?;
                let path = normalize_lexical(&entry.path());
                let metadata = fs::symlink_metadata(&path).map_err(display_error)?;
                if metadata.file_type().is_symlink() {
                    // asset-files 下的符号链接不参与读取/清理，避免跟随链接逃逸 Private Library。
                    continue;
                }
                if metadata.is_dir() {
                    queue.push_back(path);
                    continue;
                }
                if !metadata.is_file() { continue; }
                stored_files += 1;
                if !managed_targets.contains(&path) {
                    orphan_files.push(DesktopAssetStorageEntry {
                        storage_path: storage_path_from_library(&library_root, &path),
                        file_size: metadata.len(),
                    });
                }
            }
        }
    }

    orphan_files.sort_by(|a, b| a.storage_path.cmp(&b.storage_path));
    missing_files.sort();
    missing_files.dedup();
    let mut unmanaged_references = unmanaged.into_iter().collect::<Vec<_>>();
    unmanaged_references.sort();
    let reclaimable_bytes = orphan_files.iter().fold(0_u64, |sum, file| sum.saturating_add(file.file_size));

    Ok(DesktopAssetStorageHealth {
        asset_records: assets.len(),
        managed_references: managed_targets.len(),
        stored_files,
        orphan_files,
        missing_files,
        unmanaged_references,
        reclaimable_bytes,
    })
}

fn storage_path_from_library(library_root: &Path, target: &Path) -> String {
    target.strip_prefix(library_root).unwrap_or(target).to_string_lossy().replace('\\', "/")
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

fn locate_example_resource(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    locate_example_resource_optional(app, relative).ok_or_else(|| {
        format!("Localogue 内置示例资源缺失：{relative}。请重新安装或重新构建 Desktop。")
    })
}

fn locate_example_resource_optional(app: &AppHandle, relative: &str) -> Option<PathBuf> {
    // `tauri dev` 下 target/debug 的 resource_dir 可能保留上一轮复制出来的示例资源。
    // Debug 构建优先从当前 Localogue 仓库根目录读取 examples，确保开发者刚覆盖的
    // Fixture JSON / 图片可以立即 provision；Release 构建则只消费安装包内的 $RESOURCE。
    #[cfg(debug_assertions)]
    if let Ok(current) = std::env::current_dir() {
        let mut cursor = Some(current.as_path());
        for _ in 0..8 {
            let Some(base) = cursor else { break; };
            let looks_like_localogue_root = base.join("pnpm-workspace.yaml").is_file()
                && base.join("apps/desktop/src-tauri/Cargo.toml").is_file();
            if looks_like_localogue_root {
                let candidate = base.join(relative);
                if candidate.is_dir() {
                    return Some(candidate);
                }
                break;
            }
            cursor = base.parent();
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join(relative);
        if candidate.is_dir() {
            return Some(candidate);
        }
    }
    None
}

fn provision_resource_snapshot<F>(source: &Path, destination: &Path, is_complete: F) -> Result<bool, String>
where
    F: Fn(&Path) -> bool,
{
    let source_signature = directory_tree_sha256(source)?;
    let destination_signature = if is_complete(destination) { directory_tree_sha256(destination).ok() } else { None };
    if destination_signature.as_deref() == Some(source_signature.as_str()) { return Ok(false); }

    let parent = destination.parent().ok_or_else(|| "示例资源目标缺少父目录。".to_string())?;
    fs::create_dir_all(parent).map_err(display_error)?;
    let file_name = destination.file_name().and_then(|value| value.to_str()).unwrap_or("example-resource");
    let temporary = parent.join(format!("{file_name}.tmp-{}", now_marker()));
    if temporary.exists() { fs::remove_dir_all(&temporary).map_err(display_error)?; }
    copy_directory_tree(source, &temporary)?;
    if destination.exists() { fs::remove_dir_all(destination).map_err(display_error)?; }
    fs::rename(&temporary, destination).map_err(display_error)?;
    Ok(true)
}

fn example_library_is_complete(path: &Path) -> bool {
    ["works", "people", "assets", "asset-files", "presentation-preferences"]
        .iter()
        .all(|name| path.join(name).is_dir())
}

fn directory_tree_sha256(root: &Path) -> Result<String, String> {
    if !root.is_dir() {
        return Err(format!("目录不存在：{}", root.display()));
    }

    fn collect_files(root: &Path, current: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in fs::read_dir(current).map_err(display_error)? {
            let entry = entry.map_err(display_error)?;
            let path = entry.path();
            let file_type = entry.file_type().map_err(display_error)?;
            if file_type.is_dir() {
                collect_files(root, &path, files)?;
            } else if file_type.is_file() {
                let relative = path.strip_prefix(root).map_err(display_error)?.to_path_buf();
                files.push(relative);
            }
        }
        Ok(())
    }

    let mut files = Vec::new();
    collect_files(root, root, &mut files)?;
    files.sort();

    let mut digest = Sha256::new();
    for relative in files {
        let normalized = relative.to_string_lossy().replace('\\', "/");
        digest.update(normalized.as_bytes());
        digest.update([0]);
        let mut file = File::open(root.join(&relative)).map_err(display_error)?;
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            let read = file.read(&mut buffer).map_err(display_error)?;
            if read == 0 { break; }
            digest.update(&buffer[..read]);
        }
        digest.update([0xff]);
    }
    let digest = digest.finalize();
    Ok(format!("{digest:x}"))
}

fn copy_directory_tree(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_dir() {
        return Err(format!("示例资源目录不存在：{}", source.display()));
    }
    fs::create_dir_all(destination).map_err(display_error)?;
    for entry in fs::read_dir(source).map_err(display_error)? {
        let entry = entry.map_err(display_error)?;
        let file_type = entry.file_type().map_err(display_error)?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_directory_tree(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), target).map_err(display_error)?;
        }
    }
    Ok(())
}

fn normalize_settings(mut value: DesktopBootstrapSettings) -> Result<DesktopBootstrapSettings, String> {
    value.schema_version = 1;
    value.library_path = clean_optional_path(value.library_path)?;
    value.ffprobe_path = clean_optional_path(value.ffprobe_path)?;
    value.library_roots = unique_clean_paths(value.library_roots)?;
    value.media_scan_paths = unique_clean_paths(value.media_scan_paths)?;
    value.nfo_scan_paths = unique_clean_paths(value.nfo_scan_paths)?;
    value.shared_pack_paths = unique_clean_paths(value.shared_pack_paths)?;
    value.library_profiles = normalize_library_profiles(value.library_profiles)?;
    value.active_library_profile_id = clean_optional_text(value.active_library_profile_id, 160)?;
    let active_is_valid = value.active_library_profile_id.as_deref()
        .map(|active_id| value.library_profiles.iter().any(|profile| profile.id == active_id))
        .unwrap_or(false);
    if !active_is_valid {
        value.active_library_profile_id = value.library_profiles.first().map(|profile| profile.id.clone());
    }
    let web_url = value.web_url.trim();
    value.web_url = if web_url.is_empty() { "http://127.0.0.1:3000".into() } else { web_url.into() };
    Ok(value)
}

fn normalize_library_profiles(values: Vec<DesktopLibraryProfile>) -> Result<Vec<DesktopLibraryProfile>, String> {
    if values.len() > 64 {
        return Err("Library Profile 数量超过 64 个安全上限。".to_string());
    }
    let mut output = Vec::new();
    let mut ids = HashSet::new();
    for mut profile in values {
        profile.id = clean_required_text(profile.id, "Library Profile id", 160)?;
        profile.name = clean_required_text(profile.name, "Library Profile name", 80)?;
        if !ids.insert(profile.id.clone()) {
            return Err(format!("Library Profile id 重复：{}", profile.id));
        }
        profile.description = clean_optional_text(profile.description, 240)?;
        profile.library_path = clean_optional_path(profile.library_path)?;
        profile.library_roots = unique_clean_paths(profile.library_roots)?;
        profile.media_scan_paths = unique_clean_paths(profile.media_scan_paths)?;
        profile.nfo_scan_paths = unique_clean_paths(profile.nfo_scan_paths)?;
        profile.shared_pack_paths = unique_clean_paths(profile.shared_pack_paths)?;
        profile.created_at = clean_optional_text(profile.created_at, 80)?;
        profile.updated_at = clean_optional_text(profile.updated_at, 80)?;
        output.push(profile);
    }
    Ok(output)
}

fn clean_required_text(value: String, label: &str, max_chars: usize) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} 不能为空。"));
    }
    if trimmed.chars().count() > max_chars {
        return Err(format!("{label} 超过 {max_chars} 个字符。"));
    }
    if trimmed.chars().any(|character| character.is_control()) {
        return Err(format!("{label} 不能包含控制字符。"));
    }
    Ok(trimmed.to_string())
}

fn clean_optional_text(value: Option<String>, max_chars: usize) -> Result<Option<String>, String> {
    match value {
        None => Ok(None),
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            if trimmed.chars().count() > max_chars {
                return Err(format!("Settings 文本超过 {max_chars} 个字符。"));
            }
            if trimmed.chars().any(|character| character.is_control()) {
                return Err("Settings 文本不能包含控制字符。".to_string());
            }
            Ok(Some(trimmed.to_string()))
        }
    }
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

fn same_library_path(left: &str, right: &str) -> bool {
    if left.trim().is_empty() || right.trim().is_empty() { return false; }
    let left = path_to_string(&normalize_lexical(Path::new(left.trim()))).replace('\\', "/");
    let right = path_to_string(&normalize_lexical(Path::new(right.trim()))).replace('\\', "/");
    if cfg!(windows) { left.eq_ignore_ascii_case(&right) } else { left == right }
}

fn path_to_string(path: &Path) -> String { path.to_string_lossy().into_owned() }
fn display_error(error: impl std::fmt::Display) -> String { error.to_string() }
fn now_marker() -> String {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_millis().to_string()).unwrap_or_else(|_| "0".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_storage_cleanup_deletes_only_current_orphans() {
        let root = std::env::temp_dir().join(format!("localogue-asset-storage-{}", now_marker()));
        let assets = root.join("assets");
        let files = root.join("asset-files");
        fs::create_dir_all(&assets).expect("create assets");
        fs::create_dir_all(&files).expect("create asset-files");
        fs::write(files.join("used.jpg"), b"used").expect("write used");
        fs::write(files.join("orphan.jpg"), b"orphan").expect("write orphan");
        fs::write(
            assets.join("asset_used.json"),
            r#"{"id":"asset_used","storagePath":"asset-files/used.jpg"}"#,
        ).expect("write asset json");

        let before = inspect_asset_storage_at(&root).expect("inspect before");
        assert_eq!(before.asset_records, 1);
        assert_eq!(before.managed_references, 1);
        assert_eq!(before.stored_files, 2);
        assert_eq!(before.orphan_files.len(), 1);
        assert_eq!(before.orphan_files[0].storage_path, "asset-files/orphan.jpg");
        assert_eq!(before.missing_files.len(), 0);

        let cleanup = cleanup_asset_orphans_at(&root).expect("cleanup");
        assert_eq!(cleanup.deleted_files, 1);
        assert!(files.join("used.jpg").is_file());
        assert!(!files.join("orphan.jpg").exists());

        fs::remove_file(files.join("used.jpg")).expect("remove used");
        let after = inspect_asset_storage_at(&root).expect("inspect after");
        assert_eq!(after.orphan_files.len(), 0);
        assert_eq!(after.missing_files, vec!["asset-files/used.jpg".to_string()]);

        fs::remove_dir_all(root).expect("cleanup temp library");
    }

    #[test]
    fn portable_preview_separates_new_identical_and_conflict_files() {
        let root = std::env::temp_dir().join(format!("localogue-portable-preview-{}", now_marker()));
        fs::create_dir_all(root.join("works")).expect("create works");
        fs::create_dir_all(root.join("presentation-preferences")).expect("create presentation");
        fs::write(root.join("works/same.json"), b"same").expect("write same");
        fs::write(root.join("works/conflict.json"), b"local").expect("write conflict");

        let digest = |path: &str, bytes: &[u8]| DesktopPortableFileDigest {
            path: path.to_string(),
            sha256: format!("{:x}", Sha256::digest(bytes)),
            size: bytes.len() as u64,
        };
        let files = vec![
            digest("works/same.json", b"same"),
            digest("works/conflict.json", b"incoming"),
            digest("presentation-preferences/new.json", b"{}"),
        ];
        let preview = preview_private_portable_files_at(&root, &files).expect("preview");
        assert_eq!(preview.target_library_path, path_to_string(&root));
        assert_eq!(preview.new_files, 1);
        assert_eq!(preview.identical_files, 1);
        assert_eq!(preview.conflict_files, 1);
        assert_eq!(preview.categories.get("canonical").expect("canonical").identical_files, 1);
        assert_eq!(preview.categories.get("canonical").expect("canonical").conflict_files, 1);
        assert_eq!(preview.categories.get("presentation").expect("presentation").new_files, 1);

        fs::remove_dir_all(root).expect("cleanup portable preview");
    }


    #[test]
    fn portable_target_lock_compares_library_paths_safely() {
        let root = std::env::temp_dir().join("localogue-portable-target-lock");
        let root_text = path_to_string(&root);
        assert!(same_library_path(&root_text, &root_text));
        assert!(!same_library_path(&root_text, &format!("{}-other", root_text)));
        assert!(!same_library_path(&root_text, ""));
    }

    #[cfg(unix)]
    #[test]
    fn portable_preview_rejects_symlink_parent() {
        use std::os::unix::fs::symlink;

        let root = std::env::temp_dir().join(format!("localogue-portable-symlink-test-{}", now_marker()));
        let outside = std::env::temp_dir().join(format!("localogue-portable-outside-test-{}", now_marker()));
        fs::create_dir_all(&root).expect("root");
        fs::create_dir_all(&outside).expect("outside");
        symlink(&outside, root.join("assets")).expect("symlink");

        let files = vec![DesktopPortableFileDigest {
            path: "assets/redirected.json".into(),
            sha256: "0".repeat(64),
            size: 2,
        }];
        let error = preview_private_portable_files_at(&root, &files).expect_err("symlink parent must be rejected");
        assert!(error.contains("符号链接") || error.contains("Reparse Point"));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

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
            provision_example_library,
            pick_directory,
            pick_media_file,
            pick_image_file,
            pick_portable_pack_file,
            read_portable_pack_file,
            save_portable_pack_file,
            collect_private_portable_files,
            preview_private_portable_files,
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
            read_resolved_asset_bytes,
            inspect_private_asset_storage,
            cleanup_private_asset_orphans,
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
