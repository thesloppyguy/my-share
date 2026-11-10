use std::path::PathBuf;
use std::time::SystemTime;

use super::device::DeviceId;

// ----------------------------------
// Settings (persisted)
// ----------------------------------

/// Clipboard sync preferences.
#[derive(Debug, Clone, PartialEq, Eq)]
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
#[derive(Debug, Clone, PartialEq, Eq)]
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
}

/// A single history / sync entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClipboardEntry {
    pub id: String,
    pub content: ClipboardContent,
    /// Device that produced this entry; `None` means this local device.
    pub source_device: Option<DeviceId>,
    pub created_at: SystemTime,
}
