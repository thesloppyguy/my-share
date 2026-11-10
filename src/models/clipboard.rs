use std::path::PathBuf;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use super::device::DeviceId;
use crate::time_util::{system_time_from_millis, system_time_to_millis};

// ----------------------------------
// Settings (persisted)
// ----------------------------------

/// Clipboard sync preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClipboardSettings {
    pub enabled: bool,
    /// Max history entries to retain locally; `0` disables history.
    pub history_limit: usize,
    /// Run OCR on incoming images when the platform supports it.
    pub text_recognition: bool,
    /// App names / bundle IDs that should not participate in clipboard sync.
    pub disabled_applications: Vec<String>,
}

impl Default for ClipboardSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            history_limit: 50,
            text_recognition: false,
            disabled_applications: Vec::new(),
        }
    }
}

// ----------------------------------
// Payload (runtime / sync)
// ----------------------------------

/// One clipboard payload that can be synced between devices.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum ClipboardContent {
    Text(String),
    Html {
        html: String,
        plain: Option<String>,
    },
    /// Raw image bytes (PNG/JPEG/etc.); format is negotiated at the protocol layer.
    Image(Vec<u8>),
    Files(Vec<PathBuf>),
}

impl ClipboardContent {
    pub fn size_bytes(&self) -> u64 {
        match self {
            Self::Text(text) => text.len() as u64,
            Self::Html { html, plain } => {
                (html.len() + plain.as_ref().map_or(0, String::len)) as u64
            }
            Self::Image(bytes) => bytes.len() as u64,
            Self::Files(_) => 0,
        }
    }

    /// Stable fingerprint used to detect clipboard changes across polls.
    pub fn fingerprint(&self) -> String {
        match self {
            Self::Text(text) => format!("text:{}", blake3::hash(text.as_bytes()).to_hex()),
            Self::Html { html, plain } => {
                let mut hasher = blake3::Hasher::new();
                hasher.update(html.as_bytes());
                if let Some(plain) = plain {
                    hasher.update(b"\0");
                    hasher.update(plain.as_bytes());
                }
                format!("html:{}", hasher.finalize().to_hex())
            }
            Self::Image(bytes) => format!("image:{}", blake3::hash(bytes).to_hex()),
            Self::Files(paths) => {
                let mut hasher = blake3::Hasher::new();
                for path in paths {
                    hasher.update(path.to_string_lossy().as_bytes());
                    hasher.update(b"\0");
                }
                format!("files:{}", hasher.finalize().to_hex())
            }
        }
    }
}

/// A single history / sync entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: String,
    pub content: ClipboardContent,
    /// Device that produced this entry; `None` means this local device.
    pub source_device: Option<DeviceId>,
    #[serde(
        serialize_with = "serialize_system_time",
        deserialize_with = "deserialize_system_time"
    )]
    pub created_at: SystemTime,
}

fn serialize_system_time<S>(value: &SystemTime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_i64(system_time_to_millis(*value))
}

fn deserialize_system_time<'de, D>(deserializer: D) -> Result<SystemTime, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let millis = i64::deserialize(deserializer)?;
    Ok(system_time_from_millis(millis))
}
