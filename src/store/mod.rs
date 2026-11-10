mod schema;

use std::path::{Path, PathBuf};

use sqlx::{Sqlite, SqlitePool, migrate::MigrateDatabase};

use crate::errors::StoreError;
use crate::models::account::Account;
use crate::models::clipboard::ClipboardEntry;
use crate::models::device::Device;
use crate::models::watch::{WatchEvent, WatchedFolder};
use crate::time_util::{system_time_from_millis, system_time_to_millis};

/// Durable SQLite-backed state that survives process restarts.
#[derive(Clone, Debug)]
pub struct Store {
    pool: SqlitePool,
    path: PathBuf,
}

impl Store {
    /// Open (or create) the app database at `path`.
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, StoreError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let url = sqlite_url(&path)?;
        if !Sqlite::database_exists(&url).await? {
            Sqlite::create_database(&url).await?;
        }

        let pool = SqlitePool::connect(&url).await?;
        schema::migrate(&pool).await?;

        Ok(Self { pool, path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    // ----------------------------------
    // Account / settings
    // ----------------------------------

    pub async fn load_account(&self) -> Result<Account, StoreError> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT payload FROM account WHERE id = 1",
        )
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some((payload,)) => Ok(serde_json::from_str(&payload)?),
            None => {
                let account = Account::default();
                self.save_account(&account).await?;
                Ok(account)
            }
        }
    }

    pub async fn save_account(&self, account: &Account) -> Result<(), StoreError> {
        let payload = serde_json::to_string(account)?;
        sqlx::query(
            "INSERT INTO account (id, payload) VALUES (1, ?)
             ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(payload)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ----------------------------------
    // Devices
    // ----------------------------------

    pub async fn load_local_device(&self) -> Result<Option<Device>, StoreError> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT payload FROM devices WHERE is_local = 1 LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await?;

        row.map(|(payload,)| Ok(serde_json::from_str(&payload)?))
            .transpose()
    }

    pub async fn save_local_device(&self, device: &Device) -> Result<(), StoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE devices SET is_local = 0 WHERE is_local = 1")
            .execute(&mut *tx)
            .await?;
        upsert_device_tx(&mut tx, device, true).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn upsert_device(&self, device: &Device) -> Result<(), StoreError> {
        let mut tx = self.pool.begin().await?;
        upsert_device_tx(&mut tx, device, false).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn list_devices(&self) -> Result<Vec<Device>, StoreError> {
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT payload FROM devices ORDER BY name COLLATE NOCASE")
                .fetch_all(&self.pool)
                .await?;

        rows.into_iter()
            .map(|(payload,)| Ok(serde_json::from_str(&payload)?))
            .collect()
    }

    // ----------------------------------
    // Watched folders
    // ----------------------------------

    pub async fn list_watched_folders(&self) -> Result<Vec<WatchedFolder>, StoreError> {
        let rows: Vec<(String, i64, i64)> = sqlx::query_as(
            "SELECT path, recursive, enabled FROM watched_folders ORDER BY path COLLATE NOCASE",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(path, recursive, enabled)| WatchedFolder {
                path: PathBuf::from(path),
                recursive: recursive != 0,
                enabled: enabled != 0,
            })
            .collect())
    }

    pub async fn replace_watched_folders(
        &self,
        folders: &[WatchedFolder],
    ) -> Result<(), StoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM watched_folders")
            .execute(&mut *tx)
            .await?;

        for folder in folders {
            sqlx::query(
                "INSERT INTO watched_folders (path, recursive, enabled) VALUES (?, ?, ?)",
            )
            .bind(folder.path.to_string_lossy().as_ref())
            .bind(folder.recursive as i64)
            .bind(folder.enabled as i64)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    // ----------------------------------
    // Clipboard history
    // ----------------------------------

    pub async fn push_clipboard_entry(
        &self,
        entry: &ClipboardEntry,
        history_limit: usize,
    ) -> Result<(), StoreError> {
        if history_limit == 0 {
            sqlx::query("DELETE FROM clipboard_entries")
                .execute(&self.pool)
                .await?;
            return Ok(());
        }

        let payload = serde_json::to_string(&entry.content)?;
        let created_at = system_time_to_millis(entry.created_at);

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO clipboard_entries (id, content_json, source_device, created_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               content_json = excluded.content_json,
               source_device = excluded.source_device,
               created_at = excluded.created_at",
        )
        .bind(&entry.id)
        .bind(payload)
        .bind(entry.source_device.as_deref())
        .bind(created_at)
        .execute(&mut *tx)
        .await?;

        // Keep newest `history_limit` rows.
        sqlx::query(
            "DELETE FROM clipboard_entries
             WHERE id NOT IN (
               SELECT id FROM clipboard_entries
               ORDER BY created_at DESC, id DESC
               LIMIT ?
             )",
        )
        .bind(history_limit as i64)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    pub async fn list_clipboard_history(
        &self,
        limit: usize,
    ) -> Result<Vec<ClipboardEntry>, StoreError> {
        let rows: Vec<(String, String, Option<String>, i64)> = sqlx::query_as(
            "SELECT id, content_json, source_device, created_at
             FROM clipboard_entries
             ORDER BY created_at DESC, id DESC
             LIMIT ?",
        )
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(|(id, content_json, source_device, created_at)| {
                Ok(ClipboardEntry {
                    id,
                    content: serde_json::from_str(&content_json)?,
                    source_device,
                    created_at: system_time_from_millis(created_at),
                })
            })
            .collect()
    }

    pub async fn clear_clipboard_history(&self) -> Result<(), StoreError> {
        sqlx::query("DELETE FROM clipboard_entries")
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ----------------------------------
    // Watch event log
    // ----------------------------------

    pub async fn record_watch_event(&self, event: &WatchEvent) -> Result<(), StoreError> {
        sqlx::query(
            "INSERT INTO watch_events (path, renamed_from, kind, at)
             VALUES (?, ?, ?, ?)",
        )
        .bind(event.path.to_string_lossy().as_ref())
        .bind(
            event
                .renamed_from
                .as_ref()
                .map(|p| p.to_string_lossy().into_owned()),
        )
        .bind(serde_json::to_string(&event.kind)?.trim_matches('"'))
        .bind(system_time_to_millis(event.at))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn recent_watch_events(&self, limit: usize) -> Result<Vec<WatchEvent>, StoreError> {
        let rows: Vec<(String, Option<String>, String, i64)> = sqlx::query_as(
            "SELECT path, renamed_from, kind, at
             FROM watch_events
             ORDER BY at DESC, id DESC
             LIMIT ?",
        )
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(|(path, renamed_from, kind, at)| {
                let kind = serde_json::from_str(&format!("\"{kind}\""))?;
                Ok(WatchEvent {
                    path: PathBuf::from(path),
                    renamed_from: renamed_from.map(PathBuf::from),
                    kind,
                    at: system_time_from_millis(at),
                })
            })
            .collect()
    }
}

async fn upsert_device_tx(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    device: &Device,
    mark_local: bool,
) -> Result<(), StoreError> {
    let payload = serde_json::to_string(device)?;
    let is_local = if mark_local {
        1
    } else {
        // Preserve existing local flag when upserting a remote/known device.
        let existing: Option<(i64,)> =
            sqlx::query_as("SELECT is_local FROM devices WHERE id = ?")
                .bind(&device.id)
                .fetch_optional(&mut **tx)
                .await?;
        existing.map(|(v,)| v).unwrap_or(0)
    };

    sqlx::query(
        "INSERT INTO devices (id, name, payload, is_local, updated_at)
         VALUES (?, ?, ?, ?, strftime('%s','now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           payload = excluded.payload,
           is_local = excluded.is_local,
           updated_at = excluded.updated_at",
    )
    .bind(&device.id)
    .bind(&device.name)
    .bind(payload)
    .bind(is_local)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

fn sqlite_url(path: &Path) -> Result<String, StoreError> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()?.join(path)
    };

    // Ensure parent exists so canonicalize of the parent succeeds before the file does.
    if let Some(parent) = absolute.parent() {
        std::fs::create_dir_all(parent)?;
        let parent = std::fs::canonicalize(parent)?;
        let name = absolute
            .file_name()
            .ok_or_else(|| StoreError::InvalidPath(absolute.clone()))?;
        return Ok(format!("sqlite://{}", parent.join(name).display()));
    }

    Err(StoreError::InvalidPath(absolute))
}

#[cfg(test)]
mod tests {
    use std::time::SystemTime;

    use tempfile::TempDir;

    use super::Store;
    use crate::models::account::{Account, AutoAccept, Profile, Settings};
    use crate::models::clipboard::{ClipboardContent, ClipboardEntry, ClipboardSettings};
    use crate::models::device::{Device, Hardware, Platform};
    use crate::models::watch::{WatchEvent, WatchEventKind, WatchSettings, WatchedFolder};

    async fn temp_store() -> (TempDir, Store) {
        let dir = TempDir::new().expect("tempdir");
        let store = Store::open(dir.path().join("my-share.db"))
            .await
            .expect("open store");
        (dir, store)
    }

    #[tokio::test]
    async fn account_persists_across_reopen() {
        let dir = TempDir::new().unwrap();
        let db = dir.path().join("app.db");

        {
            let store = Store::open(&db).await.unwrap();
            let mut account = Account::default();
            account.profile = Profile {
                name: "Sahil".into(),
                email: "sahil@example.com".into(),
                avatar_path: None,
            };
            account.settings.auto_accept = AutoAccept::MyDevices;
            account.settings.play_sound = false;
            account.clipboard = ClipboardSettings {
                enabled: true,
                history_limit: 20,
                text_recognition: true,
                disabled_applications: vec!["PasswordManager".into()],
            };
            account.watch = WatchSettings {
                enabled: true,
                ignored: vec!["node_modules".into()],
            };
            store.save_account(&account).await.unwrap();
        }

        let store = Store::open(&db).await.unwrap();
        let loaded = store.load_account().await.unwrap();
        assert_eq!(loaded.profile.name, "Sahil");
        assert_eq!(loaded.settings.auto_accept, AutoAccept::MyDevices);
        assert!(!loaded.settings.play_sound);
        assert!(loaded.clipboard.enabled);
        assert_eq!(loaded.clipboard.history_limit, 20);
        assert_eq!(loaded.watch.ignored, vec!["node_modules".to_string()]);
    }

    #[tokio::test]
    async fn local_device_and_peers_persist() {
        let (_dir, store) = temp_store().await;

        let local = Device {
            id: "local-1".into(),
            name: "MacBook".into(),
            hardware: Hardware::Computer,
            platform: Platform::MacOs,
            app_version: "0.1.0".into(),
        };
        store.save_local_device(&local).await.unwrap();

        let phone = Device {
            id: "phone-1".into(),
            name: "Pixel".into(),
            hardware: Hardware::Phone,
            platform: Platform::Android,
            app_version: "0.1.0".into(),
        };
        store.upsert_device(&phone).await.unwrap();

        let loaded_local = store.load_local_device().await.unwrap().unwrap();
        assert_eq!(loaded_local, local);

        let devices = store.list_devices().await.unwrap();
        assert_eq!(devices.len(), 2);
    }

    #[tokio::test]
    async fn watched_folders_round_trip() {
        let (_dir, store) = temp_store().await;
        let folders = vec![
            WatchedFolder::new("/tmp/a"),
            WatchedFolder {
                path: "/tmp/b".into(),
                recursive: false,
                enabled: false,
            },
        ];
        store.replace_watched_folders(&folders).await.unwrap();
        assert_eq!(store.list_watched_folders().await.unwrap(), folders);
    }

    #[tokio::test]
    async fn clipboard_history_respects_limit() {
        let (_dir, store) = temp_store().await;

        for i in 0..5 {
            let entry = ClipboardEntry {
                id: format!("e{i}"),
                content: ClipboardContent::Text(format!("clip-{i}")),
                source_device: None,
                created_at: SystemTime::now(),
            };
            store.push_clipboard_entry(&entry, 3).await.unwrap();
            // Ensure ordering even on coarse clocks.
            tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        }

        let history = store.list_clipboard_history(10).await.unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(
            history
                .iter()
                .map(|e| e.id.as_str())
                .collect::<Vec<_>>(),
            vec!["e4", "e3", "e2"]
        );
    }

    #[tokio::test]
    async fn watch_events_persist() {
        let (_dir, store) = temp_store().await;
        let event = WatchEvent {
            path: "/tmp/a/notes.txt".into(),
            renamed_from: None,
            kind: WatchEventKind::Modified,
            at: SystemTime::now(),
        };
        store.record_watch_event(&event).await.unwrap();
        let recent = store.recent_watch_events(10).await.unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].kind, WatchEventKind::Modified);
        assert_eq!(recent[0].path, event.path);
    }

    #[tokio::test]
    async fn defaults_seed_empty_account() {
        let (_dir, store) = temp_store().await;
        let account = store.load_account().await.unwrap();
        assert_eq!(account, Account::default());
        assert_eq!(account.settings, Settings::default());
    }
}
