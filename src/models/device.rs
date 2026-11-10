use serde::{Deserialize, Serialize};

pub type DeviceId = String;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Hardware {
    Phone,
    Tablet,
    Computer,
    #[default]
    Other,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Platform {
    Android,
    Ios,
    Windows,
    MacOs,
    Linux,
    #[default]
    Other,
}

/// Derived from live connections / dial state — not stored on `Device`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeviceStatus {
    Online,
    Offline,
    Connecting,
    Dialing,
    Error(String),
}

/// Application-level identity and hardware metadata.
///
/// Kept separate from libp2p `Peer` so a device can rotate cryptographic
/// identity without losing its app-level record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Device {
    pub id: DeviceId,
    pub name: String,
    pub hardware: Hardware,
    pub platform: Platform,
    pub app_version: String,
}

impl Device {
    pub fn local_default(name: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.into(),
            hardware: Hardware::Computer,
            platform: current_platform(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

/// Derive status from the connection manager's runtime view.
pub fn device_status(connection_count: usize, is_dialing: bool) -> DeviceStatus {
    if connection_count > 0 {
        DeviceStatus::Online
    } else if is_dialing {
        DeviceStatus::Dialing
    } else {
        DeviceStatus::Offline
    }
}

fn current_platform() -> Platform {
    if cfg!(target_os = "macos") {
        Platform::MacOs
    } else if cfg!(target_os = "windows") {
        Platform::Windows
    } else if cfg!(target_os = "linux") {
        Platform::Linux
    } else if cfg!(target_os = "ios") {
        Platform::Ios
    } else if cfg!(target_os = "android") {
        Platform::Android
    } else {
        Platform::Other
    }
}
