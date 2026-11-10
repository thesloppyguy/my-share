use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::clipboard::ClipboardSettings;
use super::watch::WatchSettings;

// ----------------------------------
// Profile
// ----------------------------------

/// Local user identity shown to other devices.
///
/// Avatar bytes stay out of this model — store a path and decode in the UI layer.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub email: String,
    pub avatar_path: Option<PathBuf>,
}

// ----------------------------------
// Transfer / app preferences
// ----------------------------------

/// Who may send files without an explicit confirm prompt.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutoAccept {
    #[default]
    Never,
    MyDevices,
    AllDevices,
}

/// Persisted app preferences (transfers, sounds, launch behavior).
///
/// Feature-specific prefs live on [`ClipboardSettings`] / [`WatchSettings`].
/// App version lives on [`super::device::Device::app_version`], not here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Settings {
    pub launch_on_login: bool,
    pub play_sound: bool,
    pub auto_accept: AutoAccept,
    pub save_path: PathBuf,
    pub save_photos_to_gallery: bool,
    /// Soft cap in mebibytes; `0` means unlimited.
    pub upload_limit_mb: u64,
    /// Soft cap in mebibytes; `0` means unlimited.
    pub download_limit_mb: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            launch_on_login: false,
            play_sound: true,
            auto_accept: AutoAccept::Never,
            save_path: PathBuf::new(),
            save_photos_to_gallery: true,
            upload_limit_mb: 0,
            download_limit_mb: 0,
        }
    }
}

// ----------------------------------
// Account aggregate
// ----------------------------------

/// Everything that belongs to the local user account / prefs surface.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Account {
    pub profile: Profile,
    pub settings: Settings,
    pub clipboard: ClipboardSettings,
    pub watch: WatchSettings,
}
