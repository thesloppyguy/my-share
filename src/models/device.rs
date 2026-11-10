pub type DeviceId = String;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Hardware {
    Phone,
    Tablet,
    Computer,
    #[default]
    Other,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash)]
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
#[derive(Debug, Clone)]
pub struct Device {
    pub id: DeviceId,
    pub name: String,
    pub hardware: Hardware,
    pub platform: Platform,
    pub app_version: String,
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
