use std::path::Path;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::auth::{self, RegistryClient};
use crate::errors::{MonitorError, StoreError};
use crate::models::account::{Account, Profile, Settings};
use crate::models::clipboard::{ClipboardContent, ClipboardEntry, ClipboardSettings};
use crate::models::device::Device;
use crate::models::peer::{
    DiscoverySource, Peer, PeerAddress, PeerRegistry, RegistrySnapshot,
};
use crate::models::watch::{WatchEvent, WatchSettings, WatchedFolder};
use crate::monitor::{ClipboardTracker, FolderMonitor};
use crate::store::{AuthSessionRecord, Store};
use crate::time_util::system_time_to_millis;

#[derive(Debug, Clone)]
struct PendingOtp {
    email: String,
    expires_at: Instant,
}

/// In-memory runtime view backed by [`Store`] for cross-run persistence.
pub struct AppState {
    store: Store,
    pub account: Account,
    pub local_device: Device,
    pub watched_folders: Vec<WatchedFolder>,
    pub registry: PeerRegistry,
    pub authenticated: bool,
    pub access_token: Option<String>,
    pub user_id: Option<String>,
    clipboard: ClipboardTracker,
    folder_monitor: Option<FolderMonitor>,
    pending_otp: Option<PendingOtp>,
    auth_client: RegistryClient,
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
        let mut registry = store.load_peer_registry().await?;
        registry.upsert_device(local_device.clone());

        let mut clipboard = ClipboardTracker::new();
        let history = store
            .list_clipboard_history(account.clipboard.history_limit.max(1))
            .await?;
        clipboard.seed_from_history(&history);

        let auth_session = store.load_auth_session().await?;
        let authenticated = auth_session
            .as_ref()
            .map(|session| session.logged_in && session.access_token.is_some())
            .unwrap_or(false);
        let access_token = auth_session
            .as_ref()
            .and_then(|session| session.access_token.clone());
        let user_id = auth_session
            .as_ref()
            .and_then(|session| session.user_id.clone());

        Ok(Self {
            store,
            account,
            local_device,
            watched_folders,
            registry,
            authenticated,
            access_token,
            user_id,
            clipboard,
            folder_monitor: None,
            pending_otp: None,
            auth_client: RegistryClient::from_env(),
        })
    }

    pub fn store(&self) -> &Store {
        &self.store
    }

    pub async fn save_account(&mut self) -> Result<(), StoreError> {
        self.store.save_account(&self.account).await
    }

    pub async fn save_local_device(&mut self) -> Result<(), StoreError> {
        self.store.save_local_device(&self.local_device).await?;
        self.registry.upsert_device(self.local_device.clone());
        Ok(())
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

    /// Upsert a known device into store + registry.
    pub async fn remember_device(&mut self, device: Device) -> Result<(), StoreError> {
        self.store.upsert_device(&device).await?;
        self.registry.upsert_device(device);
        Ok(())
    }

    /// Register (or refresh) a network peer and optionally link it to a device.
    pub async fn remember_peer(
        &mut self,
        peer: Peer,
        device_id: Option<String>,
        address: Option<PeerAddress>,
    ) -> Result<(), StoreError> {
        self.store.upsert_peer(&peer).await?;
        let peer_id = peer.peer_id.clone();
        self.registry.upsert_peer(peer);

        if let Some(address) = address {
            self.store.upsert_peer_address(&peer_id, &address).await?;
            self.registry.upsert_address(peer_id.clone(), address);
        }

        if let Some(device_id) = device_id {
            self.store.link_device_peer(&device_id, &peer_id).await?;
            self.registry.link_device_peer(device_id, peer_id);
        }

        Ok(())
    }

    /// Convenience for UI / manual pairing: add a peer id with a Manual discovery source.
    pub async fn register_manual_peer(
        &mut self,
        peer_id: impl Into<String>,
        multiaddr: Option<String>,
        link_local_device: bool,
    ) -> Result<(), StoreError> {
        let peer_id = peer_id.into();
        let mut peer = Peer::new(peer_id.clone());
        peer.agent_version = "manual".into();

        let address = multiaddr.map(|addr| PeerAddress::new(addr, DiscoverySource::Manual));
        let device_id = link_local_device.then(|| self.local_device.id.clone());
        self.remember_peer(peer, device_id, address).await
    }

    pub fn registry_snapshot(&self) -> RegistrySnapshot {
        self.registry.snapshot()
    }

    /// Start email OTP login via the hosted registry.
    pub async fn request_otp(
        &mut self,
        email: impl Into<String>,
    ) -> Result<OtpChallenge, String> {
        let email = email.into().trim().to_lowercase();
        if !email.contains('@') || email.len() < 5 {
            return Err("Enter a valid email address".into());
        }

        let response = self.auth_client.request_otp(&email).await?;
        self.pending_otp = Some(PendingOtp {
            email: email.clone(),
            expires_at: Instant::now() + Duration::from_secs(response.expires_in_sec.max(60)),
        });

        Ok(OtpChallenge {
            email,
            expires_in_secs: response.expires_in_sec,
            dev_code: None,
        })
    }

    pub async fn verify_otp(
        &mut self,
        email: impl Into<String>,
        code: impl Into<String>,
    ) -> Result<(), String> {
        let email = email.into().trim().to_lowercase();
        let code = code.into().trim().to_string();

        let pending = self
            .pending_otp
            .as_ref()
            .ok_or_else(|| "No OTP pending. Request a code first.".to_string())?;

        if pending.expires_at < Instant::now() {
            self.pending_otp = None;
            return Err("OTP expired. Request a new code.".into());
        }
        if pending.email != email {
            return Err("Email does not match the pending OTP request.".into());
        }

        let fingerprint = auth::device_fingerprint(&format!(
            "{}|{}|{}",
            self.local_device.id,
            std::env::consts::OS,
            self.store.path().display()
        ));
        // Stable stand-in until the libp2p identity is wired into auth.
        let peer_id = self.local_device.id.clone();
        let verified = self
            .auth_client
            .verify_otp(
                &email,
                &code,
                &self.local_device.name,
                &fingerprint,
                &peer_id,
                &[],
                std::env::consts::OS,
            )
            .await?;

        self.pending_otp = None;
        self.account.profile.email = verified.email.clone();
        if self.account.profile.name.is_empty() {
            self.account.profile.name = verified
                .email
                .split('@')
                .next()
                .unwrap_or("User")
                .to_string();
        }
        self.save_account().await.map_err(|e| e.to_string())?;
        self.store
            .save_auth_session(&AuthSessionRecord {
                email: verified.email.clone(),
                logged_in: true,
                access_token: Some(verified.access_token.clone()),
                user_id: Some(verified.user_id.clone()),
                device_id: Some(verified.device_id.clone()),
            })
            .await
            .map_err(|e| e.to_string())?;
        self.access_token = Some(verified.access_token);
        self.user_id = Some(verified.user_id);
        self.authenticated = true;
        Ok(())
    }

    pub async fn logout(&mut self) -> Result<(), StoreError> {
        self.pending_otp = None;
        self.authenticated = false;
        self.access_token = None;
        self.user_id = None;
        self.store.clear_auth_session().await
    }

    pub async fn snapshot(&self) -> Result<AppSnapshot, StoreError> {
        let history = self.clipboard_history().await?;
        let clipboard_entries = history.iter().map(ClipboardEntryView::from).collect();

        Ok(AppSnapshot {
            authenticated: self.authenticated,
            store_path: self.store.path().display().to_string(),
            local_device: self.local_device.clone(),
            profile: self.account.profile.clone(),
            settings: self.account.settings.clone(),
            clipboard: self.account.clipboard.clone(),
            watch: self.account.watch.clone(),
            clipboard_count: history.len(),
            clipboard_entries,
            watched_folders: self.watched_folders.clone(),
            registry: self.registry_snapshot(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtpChallenge {
    pub email: String,
    pub expires_in_secs: u64,
    /// Only present for local/dev auth backends.
    pub dev_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntryView {
    pub id: String,
    pub kind: String,
    pub preview: String,
    pub source_device: Option<String>,
    pub created_at_ms: i64,
}

impl From<&ClipboardEntry> for ClipboardEntryView {
    fn from(entry: &ClipboardEntry) -> Self {
        let (kind, preview) = match &entry.content {
            ClipboardContent::Text(text) => ("text".into(), truncate(text, 120)),
            ClipboardContent::Html { plain, html } => (
                "html".into(),
                truncate(plain.as_deref().unwrap_or(html), 120),
            ),
            ClipboardContent::Image(_) => ("image".into(), "Image".into()),
            ClipboardContent::Files(paths) => (
                "files".into(),
                if paths.is_empty() {
                    "Files".into()
                } else {
                    paths
                        .iter()
                        .map(|p| p.file_name().and_then(|n| n.to_str()).unwrap_or("file"))
                        .collect::<Vec<_>>()
                        .join(", ")
                },
            ),
        };

        Self {
            id: entry.id.clone(),
            kind,
            preview,
            source_device: entry.source_device.clone(),
            created_at_ms: system_time_to_millis(entry.created_at),
        }
    }
}

fn truncate(value: &str, max: usize) -> String {
    let mut chars = value.chars();
    let preview: String = chars.by_ref().take(max).collect();
    if chars.next().is_some() {
        format!("{preview}…")
    } else {
        preview
    }
}

/// Serializable view for the platform / IPC layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSnapshot {
    pub authenticated: bool,
    pub store_path: String,
    pub local_device: Device,
    pub profile: Profile,
    pub settings: Settings,
    pub clipboard: ClipboardSettings,
    pub watch: WatchSettings,
    pub clipboard_count: usize,
    pub clipboard_entries: Vec<ClipboardEntryView>,
    pub watched_folders: Vec<WatchedFolder>,
    pub registry: RegistrySnapshot,
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

    #[tokio::test]
    async fn registry_peer_persists_across_reload() {
        let dir = TempDir::new().unwrap();
        let db = dir.path().join("registry.db");

        {
            let mut state = AppState::load(&db).await.unwrap();
            state
                .register_manual_peer(
                    "12D3KooWManualPeer",
                    Some("/ip4/192.168.1.10/tcp/4001".into()),
                    true,
                )
                .await
                .unwrap();
            assert_eq!(state.registry.peers.len(), 1);
            assert_eq!(state.registry.addresses.len(), 1);
        }

        let state = AppState::load(&db).await.unwrap();
        assert!(state.registry.peers.contains_key("12D3KooWManualPeer"));
        assert_eq!(
            state
                .registry
                .peers_for_device(&state.local_device.id)
                .len(),
            1
        );
        let snap = state.snapshot().await.unwrap();
        assert_eq!(snap.registry.peer_count, 1);
    }
}
