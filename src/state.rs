use std::path::Path;

use crate::errors::{MonitorError, StoreError};
use crate::models::account::Account;
use crate::models::clipboard::{ClipboardContent, ClipboardEntry};
use crate::models::device::Device;
use crate::models::watch::{WatchEvent, WatchedFolder};
use crate::monitor::{ClipboardTracker, FolderMonitor};
use crate::store::Store;

/// In-memory runtime view backed by [`Store`] for cross-run persistence.
pub struct AppState {
    store: Store,
    pub account: Account,
    pub local_device: Device,
    pub watched_folders: Vec<WatchedFolder>,
    clipboard: ClipboardTracker,
    folder_monitor: Option<FolderMonitor>,
}

impl AppState {
    /// Load persisted configuration, creating defaults on first run.
    pub async fn load(db_path: impl AsRef<Path>) -> Result<Self, StoreError> {
        let store = Store::open(db_path).await?;
        let account = store.load_account().await?;

        let local_device = match store.load_local_device().await? {
            Some(device) => device,
            None => {
                let device = Device::local_default(default_device_name());
                store.save_local_device(&device).await?;
                device
            }
        };

        let watched_folders = store.list_watched_folders().await?;

        let mut clipboard = ClipboardTracker::new();
        let history = store
            .list_clipboard_history(account.clipboard.history_limit.max(1))
            .await?;
        clipboard.seed_from_history(&history);

        Ok(Self {
            store,
            account,
            local_device,
            watched_folders,
            clipboard,
            folder_monitor: None,
        })
    }

    pub fn store(&self) -> &Store {
        &self.store
    }

    pub async fn save_account(&mut self) -> Result<(), StoreError> {
        self.store.save_account(&self.account).await
    }

    pub async fn save_local_device(&mut self) -> Result<(), StoreError> {
        self.store.save_local_device(&self.local_device).await
    }

    pub async fn set_watched_folders(
        &mut self,
        folders: Vec<WatchedFolder>,
    ) -> Result<(), StoreError> {
        self.store.replace_watched_folders(&folders).await?;
        self.watched_folders = folders;
        Ok(())
    }

    /// Start (or restart) filesystem monitoring from the current settings/folders.
    pub fn start_folder_monitor(&mut self) -> Result<(), MonitorError> {
        self.folder_monitor = None;
        if !self.account.watch.enabled {
            return Err(MonitorError::WatchDisabled);
        }
        self.folder_monitor = Some(FolderMonitor::start(
            &self.watched_folders,
            &self.account.watch,
        )?);
        Ok(())
    }

    /// Drain filesystem events and persist them.
    pub async fn poll_watch_events(&mut self) -> Result<Vec<WatchEvent>, MonitorError> {
        let Some(monitor) = &self.folder_monitor else {
            return Ok(Vec::new());
        };

        let events = monitor.drain_events()?;
        for event in &events {
            self.store.record_watch_event(event).await?;
        }
        Ok(events)
    }

    /// Feed an observed clipboard payload; persists when it is a new entry.
    pub async fn observe_clipboard(
        &mut self,
        content: ClipboardContent,
    ) -> Result<Option<ClipboardEntry>, StoreError> {
        let entry = self
            .clipboard
            .observe(content, &self.account.clipboard, None);

        if let Some(entry) = &entry {
            self.store
                .push_clipboard_entry(entry, self.account.clipboard.history_limit)
                .await?;
        }

        Ok(entry)
    }

    pub async fn clipboard_history(&self) -> Result<Vec<ClipboardEntry>, StoreError> {
        self.store
            .list_clipboard_history(self.account.clipboard.history_limit)
            .await
    }

    pub async fn known_devices(&self) -> Result<Vec<Device>, StoreError> {
        self.store.list_devices().await
    }
}

fn default_device_name() -> String {
    std::env::var("HOST")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "My Device".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::watch::WatchSettings;
    use tempfile::TempDir;

    #[tokio::test]
    async fn loads_defaults_then_persists_changes() {
        let dir = TempDir::new().unwrap();
        let db = dir.path().join("state.db");

        let device_id;
        {
            let mut state = AppState::load(&db).await.unwrap();
            device_id = state.local_device.id.clone();
            state.account.profile.name = "Sahil".into();
            state.account.clipboard.enabled = true;
            state.account.clipboard.history_limit = 5;
            state.account.watch = WatchSettings {
                enabled: true,
                ignored: vec![".cache".into()],
            };
            state.save_account().await.unwrap();

            state
                .set_watched_folders(vec![WatchedFolder::new(dir.path().join("share"))])
                .await
                .unwrap();

            let entry = state
                .observe_clipboard(ClipboardContent::Text("hello".into()))
                .await
                .unwrap()
                .expect("entry");
            assert_eq!(entry.content, ClipboardContent::Text("hello".into()));
        }

        let state = AppState::load(&db).await.unwrap();
        assert_eq!(state.local_device.id, device_id);
        assert_eq!(state.account.profile.name, "Sahil");
        assert!(state.account.clipboard.enabled);
        assert_eq!(state.watched_folders.len(), 1);
        let history = state.clipboard_history().await.unwrap();
        assert_eq!(history.len(), 1);
    }
}
