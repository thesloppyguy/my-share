use std::path::{Path, PathBuf};

use walkdir::WalkDir;

use super::hasher::hash_files_parallel;
use super::models::{FileEntry, ScanSummary};
use crate::errors::ScanError;

pub fn scan_directory(root: &Path, ignored: Option<Vec<&str>>) -> Result<ScanSummary, ScanError> {
    let mut paths: Vec<PathBuf> = Vec::new();

    let ignored = ignored.unwrap_or_default();

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }

            !(entry.file_type().is_dir()
                && entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| ignored.contains(&name)))
        })
    {
        let entry = entry?;

        if entry.file_type().is_file() {
            paths.push(entry.path().to_path_buf());
        }
    }

    let hashes = hash_files_parallel(&paths);

    let mut files = Vec::new();
    let mut total_bytes = 0u64;

    for (path, hash) in paths.into_iter().zip(hashes) {
        let metadata = std::fs::metadata(&path)?;
        let hash = hash?;

        let file = FileEntry {
            path: path.strip_prefix(root)?.to_path_buf(),
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default(),
            extension: path.extension().map(|e| e.to_string_lossy().into_owned()),
            size_bytes: metadata.len(),
            modified: metadata.modified().ok(),
            hash,
        };

        total_bytes = total_bytes
            .checked_add(file.size_bytes)
            .ok_or(ScanError::SizeOverflow)?;

        files.push(file);
    }

    Ok(ScanSummary { files, total_bytes })
}
