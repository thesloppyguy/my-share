use std::path::PathBuf;
use std::time::SystemTime;

// ----------------------------------
// Settings (persisted)
// ----------------------------------

/// Folder-watch preferences for auto-share / auto-scan.
///
/// `ignored` is a list of directory *names* (not full paths), matching the
/// scanner's `ignored` argument in [`crate::scanner`].
#[derive(Debug, Clone, PartialEq, Eq)]
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
#[derive(Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WatchEventKind {
    Created,
    Modified,
    Removed,
    Renamed,
}

/// Filesystem change observed under a [`WatchedFolder`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WatchEvent {
    pub path: PathBuf,
    /// Populated when `kind` is [`WatchEventKind::Renamed`].
    pub renamed_from: Option<PathBuf>,
    pub kind: WatchEventKind,
    pub at: SystemTime,
}
