use std::path::PathBuf;

use my_share::AppState;
use my_share::models::clipboard::ClipboardContent;
use my_share::models::watch::WatchedFolder;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("my-share.db"));

    let mut state = AppState::load(&db_path).await?;

    println!("store: {}", state.store().path().display());
    println!(
        "device: {} ({}) — {:?}",
        state.local_device.name, state.local_device.id, state.local_device.platform
    );
    println!(
        "profile: {} <{}>",
        state.account.profile.name, state.account.profile.email
    );
    println!(
        "clipboard enabled: {}, history_limit: {}",
        state.account.clipboard.enabled, state.account.clipboard.history_limit
    );
    println!(
        "watch enabled: {}, folders: {}",
        state.account.watch.enabled,
        state.watched_folders.len()
    );

    // Demo: enable clipboard history and record a sample entry when empty.
    if state.account.clipboard.history_limit == 0 {
        state.account.clipboard.history_limit = 50;
    }
    if !state.account.clipboard.enabled {
        state.account.clipboard.enabled = true;
        state.save_account().await?;
    }

    if state.clipboard_history().await?.is_empty() {
        state
            .observe_clipboard(ClipboardContent::Text(
                "welcome to my-share clipboard history".into(),
            ))
            .await?;
    }

    // Demo: ensure at least the current directory is remembered as a watch target.
    if state.watched_folders.is_empty() {
        state
            .set_watched_folders(vec![WatchedFolder::new(std::env::current_dir()?)])
            .await?;
        state.account.watch.enabled = true;
        state.save_account().await?;
    }

    println!(
        "clipboard entries: {}",
        state.clipboard_history().await?.len()
    );
    println!("known devices: {}", state.known_devices().await?.len());
    for folder in &state.watched_folders {
        println!(
            "watching: {} (recursive={}, enabled={})",
            folder.path.display(),
            folder.recursive,
            folder.enabled
        );
    }

    Ok(())
}
