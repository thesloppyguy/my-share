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
