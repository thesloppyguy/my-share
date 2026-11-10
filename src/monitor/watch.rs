use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::time::SystemTime;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::errors::MonitorError;
use crate::models::watch::{WatchEvent, WatchEventKind, WatchSettings, WatchedFolder};

/// Filesystem monitor backed by `notify`.
///
/// Call [`FolderMonitor::drain_events`] from a timer / async loop to collect
/// changes, then persist them through the store.
pub struct FolderMonitor {
    _watcher: RecommendedWatcher,
    rx: Receiver<Result<Event, notify::Error>>,
    ignored: HashSet<String>,
}

impl FolderMonitor {
    pub fn start(
        folders: &[WatchedFolder],
        settings: &WatchSettings,
    ) -> Result<Self, MonitorError> {
        if !settings.enabled {
            return Err(MonitorError::WatchDisabled);
        }

        let (tx, rx) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(tx)?;

        for folder in folders.iter().filter(|f| f.enabled) {
            let mode = if folder.recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };
            watcher.watch(&folder.path, mode)?;
        }

        Ok(Self {
            _watcher: watcher,
            rx,
            ignored: settings.ignored.iter().cloned().collect(),
        })
    }

    /// Non-blocking drain of pending filesystem events.
    pub fn drain_events(&self) -> Result<Vec<WatchEvent>, MonitorError> {
        let mut events = Vec::new();

        while let Ok(message) = self.rx.try_recv() {
            let event = message?;
            events.extend(map_notify_event(event, &self.ignored));
        }

        Ok(events)
    }
}

fn map_notify_event(event: Event, ignored: &HashSet<String>) -> Vec<WatchEvent> {
    let kind = match event.kind {
        EventKind::Create(_) => WatchEventKind::Created,
        EventKind::Modify(notify::event::ModifyKind::Name(_)) => WatchEventKind::Renamed,
        EventKind::Modify(_) => WatchEventKind::Modified,
        EventKind::Remove(_) => WatchEventKind::Removed,
        _ => return Vec::new(),
    };

    let paths: Vec<PathBuf> = event
        .paths
        .into_iter()
        .filter(|path| !is_ignored(path, ignored))
        .collect();

    if paths.is_empty() {
        return Vec::new();
    }

    let at = SystemTime::now();

    if kind == WatchEventKind::Renamed && paths.len() >= 2 {
        return vec![WatchEvent {
            path: paths[1].clone(),
            renamed_from: Some(paths[0].clone()),
            kind,
            at,
        }];
    }

    paths
        .into_iter()
        .map(|path| WatchEvent {
            path,
            renamed_from: None,
            kind,
            at,
        })
        .collect()
}

fn is_ignored(path: &Path, ignored: &HashSet<String>) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|name| ignored.contains(name))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Duration;

    use tempfile::TempDir;

    #[test]
    fn detects_new_file_in_watched_folder() {
        let dir = TempDir::new().unwrap();
        let folders = vec![WatchedFolder::new(dir.path())];
        let settings = WatchSettings {
            enabled: true,
            ignored: vec!["node_modules".into()],
        };

        let monitor = FolderMonitor::start(&folders, &settings).unwrap();

        // Some backends need a moment after watch registration.
        std::thread::sleep(Duration::from_millis(50));
        fs::write(dir.path().join("hello.txt"), b"hi").unwrap();

        let mut seen = Vec::new();
        for _ in 0..40 {
            seen.extend(monitor.drain_events().unwrap());
            if seen.iter().any(|e| {
                e.path.file_name().and_then(|n| n.to_str()) == Some("hello.txt")
                    && matches!(e.kind, WatchEventKind::Created | WatchEventKind::Modified)
            }) {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }

        assert!(
            seen.iter().any(|e| {
                e.path.ends_with("hello.txt")
                    && matches!(e.kind, WatchEventKind::Created | WatchEventKind::Modified)
            }),
            "expected create/modify for hello.txt, got {seen:?}"
        );
    }

    #[test]
    fn disabled_watch_settings_error() {
        let result = FolderMonitor::start(&[], &WatchSettings::default());
        assert!(matches!(result, Err(MonitorError::WatchDisabled)));
    }
}
