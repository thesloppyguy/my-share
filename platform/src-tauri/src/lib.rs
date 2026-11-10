use my_share::AppState;
use my_share::models::account::{Profile, Settings};
use my_share::models::clipboard::ClipboardSettings;
use my_share::models::watch::{WatchSettings, WatchedFolder};
use serde::Deserialize;
use tauri::Manager;
use tokio::sync::Mutex;

struct SharedState(Mutex<AppState>);

#[tauri::command]
async fn get_snapshot(
    state: tauri::State<'_, SharedState>,
) -> Result<my_share::AppSnapshot, String> {
    let guard = state.0.lock().await;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestOtpArgs {
    email: String,
}

#[tauri::command]
async fn request_otp(
    state: tauri::State<'_, SharedState>,
    args: RequestOtpArgs,
) -> Result<my_share::OtpChallenge, String> {
    let mut guard = state.0.lock().await;
    guard.request_otp(args.email)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyOtpArgs {
    email: String,
    code: String,
}

#[tauri::command]
async fn verify_otp(
    state: tauri::State<'_, SharedState>,
    args: VerifyOtpArgs,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.verify_otp(args.email, args.code).await?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn logout(state: tauri::State<'_, SharedState>) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.logout().await.map_err(|e| e.to_string())?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterPeerArgs {
    peer_id: String,
    multiaddr: Option<String>,
    link_local_device: bool,
}

#[tauri::command]
async fn register_peer(
    state: tauri::State<'_, SharedState>,
    args: RegisterPeerArgs,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard
        .register_manual_peer(args.peer_id, args.multiaddr, args.link_local_device)
        .await
        .map_err(|e| e.to_string())?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProfileArgs {
    name: String,
    email: String,
}

#[tauri::command]
async fn update_profile(
    state: tauri::State<'_, SharedState>,
    args: UpdateProfileArgs,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.account.profile = Profile {
        name: args.name,
        email: args.email,
        avatar_path: guard.account.profile.avatar_path.clone(),
    };
    guard.save_account().await.map_err(|e| e.to_string())?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_general_settings(
    state: tauri::State<'_, SharedState>,
    settings: Settings,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.account.settings = settings;
    guard.save_account().await.map_err(|e| e.to_string())?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_clipboard_settings(
    state: tauri::State<'_, SharedState>,
    clipboard: ClipboardSettings,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.account.clipboard = clipboard;
    guard.save_account().await.map_err(|e| e.to_string())?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateWatchArgs {
    watch: WatchSettings,
    folders: Option<Vec<WatchedFolder>>,
}

#[tauri::command]
async fn update_watch_settings(
    state: tauri::State<'_, SharedState>,
    args: UpdateWatchArgs,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.account.watch = args.watch;
    guard.save_account().await.map_err(|e| e.to_string())?;
    if let Some(folders) = args.folders {
        guard
            .set_watched_folders(folders)
            .await
            .map_err(|e| e.to_string())?;
    }
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameDeviceArgs {
    name: String,
}

#[tauri::command]
async fn rename_local_device(
    state: tauri::State<'_, SharedState>,
    args: RenameDeviceArgs,
) -> Result<my_share::AppSnapshot, String> {
    let mut guard = state.0.lock().await;
    guard.local_device.name = args.name;
    guard.save_local_device().await.map_err(|e| e.to_string())?;
    guard.snapshot().await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("my-share.db");

            let state = tauri::async_runtime::block_on(AppState::load(&db_path))
                .map_err(|e| e.to_string())?;
            app.manage(SharedState(Mutex::new(state)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            request_otp,
            verify_otp,
            logout,
            register_peer,
            update_profile,
            update_general_settings,
            update_clipboard_settings,
            update_watch_settings,
            rename_local_device
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
