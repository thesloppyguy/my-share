use std::path::PathBuf;
use std::time::SystemTime;

#[derive(Debug)]
pub struct FileEntry {
    pub path: PathBuf,
    pub name: String,
    pub extension: Option<String>,
    pub size_bytes: u64,
    pub hash: String,
    pub modified: Option<SystemTime>,
}

#[derive(Debug)]
pub struct ScanSummary {
    pub files: Vec<FileEntry>,
    pub total_bytes: u64,
}
