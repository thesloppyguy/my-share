use std::path::PathBuf;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::time_util::{system_time_from_millis, system_time_to_millis};

// ----------------------------------
// Settings (persisted)
// ----------------------------------

/// Folder-watch preferences for auto-share / auto-scan.
///
/// `ignored` is a list of directory *names* (not full paths), matching the
/// scanner's `ignored` argument in [`crate::scanner`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WatchSettings {
    pub enabled: bool,
    pub ignored: Vec<String>,
}

impl Default for WatchSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            ignored: Vec::new(),
        }
    }
}

/// One directory the user has opted to watch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WatchedFolder {
    pub path: PathBuf,
    pub recursive: bool,
    pub enabled: bool,
}

impl WatchedFolder {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            recursive: true,
            enabled: true,
        }
    }
}

// ----------------------------------
// Events (runtime)
// ----------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WatchEventKind {
    Created,
    Modified,
    Removed,
    Renamed,
}

/// Filesystem change observed under a [`WatchedFolder`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WatchEvent {
    pub path: PathBuf,
    /// Populated when `kind` is [`WatchEventKind::Renamed`].
    pub renamed_from: Option<PathBuf>,
    pub kind: WatchEventKind,
    #[serde(
        serialize_with = "serialize_system_time",
        deserialize_with = "deserialize_system_time"
    )]
    pub at: SystemTime,
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
