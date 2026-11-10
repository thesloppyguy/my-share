use std::time::SystemTime;

use uuid::Uuid;

use crate::models::clipboard::{ClipboardContent, ClipboardEntry, ClipboardSettings};
use crate::models::device::DeviceId;

/// Tracks clipboard payloads and emits history entries when content changes.
///
/// Platform clipboard readers feed observed content into [`ClipboardTracker::observe`].
/// Persistence is handled by the caller (typically [`crate::state::AppState`]).
#[derive(Debug, Default)]
pub struct ClipboardTracker {
    last_fingerprint: Option<String>,
}

impl ClipboardTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Seed the fingerprint from the latest persisted entry so a restart does not
    /// re-record the same clipboard payload.
    pub fn seed_from_history(&mut self, history: &[ClipboardEntry]) {
        self.last_fingerprint = history.first().map(|entry| entry.content.fingerprint());
    }

    /// Observe a clipboard payload.
    ///
    /// Returns `Some(entry)` when the content differs from the last observation
    /// and clipboard history is enabled.
    pub fn observe(
        &mut self,
        content: ClipboardContent,
        settings: &ClipboardSettings,
        source_device: Option<DeviceId>,
    ) -> Option<ClipboardEntry> {
        if !settings.enabled || settings.history_limit == 0 {
            self.last_fingerprint = Some(content.fingerprint());
            return None;
        }

        let fingerprint = content.fingerprint();
        if self.last_fingerprint.as_deref() == Some(fingerprint.as_str()) {
            return None;
        }

        self.last_fingerprint = Some(fingerprint);
        Some(ClipboardEntry {
            id: Uuid::new_v4().to_string(),
            content,
            source_device,
            created_at: SystemTime::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::clipboard::ClipboardSettings;

    #[test]
    fn emits_only_on_change() {
        let mut tracker = ClipboardTracker::new();
        let settings = ClipboardSettings {
            enabled: true,
            history_limit: 10,
            ..Default::default()
        };

        let first = tracker
            .observe(ClipboardContent::Text("a".into()), &settings, None)
            .expect("first change");
        assert!(matches!(first.content, ClipboardContent::Text(ref t) if t == "a"));

        assert!(
            tracker
                .observe(ClipboardContent::Text("a".into()), &settings, None)
                .is_none()
        );

        let second = tracker
            .observe(ClipboardContent::Text("b".into()), &settings, None)
            .expect("second change");
        assert!(matches!(second.content, ClipboardContent::Text(ref t) if t == "b"));
    }

    #[test]
    fn disabled_settings_skip_history() {
        let mut tracker = ClipboardTracker::new();
        let settings = ClipboardSettings::default();
        assert!(
            tracker
                .observe(ClipboardContent::Text("x".into()), &settings, None)
                .is_none()
        );
    }

    #[test]
    fn seed_suppresses_duplicate_after_restart() {
        let settings = ClipboardSettings {
            enabled: true,
            history_limit: 10,
            ..Default::default()
        };
        let existing = ClipboardEntry {
            id: "1".into(),
            content: ClipboardContent::Text("same".into()),
            source_device: None,
            created_at: SystemTime::now(),
        };

        let mut tracker = ClipboardTracker::new();
        tracker.seed_from_history(&[existing]);
        assert!(
            tracker
                .observe(ClipboardContent::Text("same".into()), &settings, None)
                .is_none()
        );
    }
}
