use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    #[error("Directory traversal failed: {0}")]
    WalkDir(#[from] walkdir::Error),

    #[error("Filesystem error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Total file size overflow")]
    SizeOverflow,

    #[error("Invalid relative path: {0}")]
    Path(#[from] std::path::StripPrefixError),
}

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Filesystem error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid store path: {0}")]
    InvalidPath(PathBuf),
}

#[derive(Debug, thiserror::Error)]
pub enum MonitorError {
    #[error("Watch error: {0}")]
    Notify(#[from] notify::Error),

    #[error("Store error: {0}")]
    Store(#[from] StoreError),

    #[error("Clipboard tracking is disabled")]
    ClipboardDisabled,

    #[error("Folder watching is disabled")]
    WatchDisabled,
}
