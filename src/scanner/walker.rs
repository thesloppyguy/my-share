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

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::scan_directory;
    use crate::models::watch::{WatchSettings, WatchedFolder};
    use crate::scanner::{FileEntry, ScanSummary};

    fn write_file(root: &Path, relative: &str, contents: &[u8]) -> PathBuf {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent dirs");
        }
        fs::write(&path, contents).expect("write file");
        path
    }

    fn relative_paths(summary: &ScanSummary) -> HashSet<PathBuf> {
        summary.files.iter().map(|f| f.path.clone()).collect()
    }

    fn find_file<'a>(summary: &'a ScanSummary, relative: &str) -> &'a FileEntry {
        summary
            .files
            .iter()
            .find(|f| f.path == Path::new(relative))
            .unwrap_or_else(|| panic!("missing scanned file: {relative}"))
    }

    /// Build a realistic watched-folder tree:
    ///
    /// ```text
    /// root/
    ///   notes.txt
    ///   photos/vacation.jpg
    ///   docs/readme.md
    ///   docs/drafts/wip.txt
    ///   node_modules/pkg/index.js   (typically ignored)
    ///   .cache/tmp.dat              (typically ignored)
    /// ```
    fn watched_tree() -> TempDir {
        let dir = TempDir::new().expect("tempdir");
        let root = dir.path();

        write_file(root, "notes.txt", b"hello watch");
        write_file(root, "photos/vacation.jpg", b"jpeg-bytes");
        write_file(root, "docs/readme.md", b"# readme");
        write_file(root, "docs/drafts/wip.txt", b"work in progress");
        write_file(root, "node_modules/pkg/index.js", b"module.exports = {}");
        write_file(root, ".cache/tmp.dat", b"cached");

        dir
    }

    #[test]
    fn scans_empty_watched_directory() {
        let dir = TempDir::new().expect("tempdir");
        let summary = scan_directory(dir.path(), None).expect("scan empty dir");

        assert!(summary.files.is_empty());
        assert_eq!(summary.total_bytes, 0);
    }

    #[test]
    fn finds_files_recursively_under_watched_folder() {
        let dir = watched_tree();
        let folder = WatchedFolder::new(dir.path());

        let summary = scan_directory(&folder.path, None).expect("scan watched folder");

        let paths = relative_paths(&summary);
        assert!(paths.contains(Path::new("notes.txt")));
        assert!(paths.contains(Path::new("photos/vacation.jpg")));
        assert!(paths.contains(Path::new("docs/readme.md")));
        assert!(paths.contains(Path::new("docs/drafts/wip.txt")));
        assert!(paths.contains(Path::new("node_modules/pkg/index.js")));
        assert!(paths.contains(Path::new(".cache/tmp.dat")));
        assert_eq!(summary.files.len(), 6);
    }

    #[test]
    fn respects_watch_settings_ignored_directories() {
        let dir = watched_tree();
        let folder = WatchedFolder::new(dir.path());
        let settings = WatchSettings {
            enabled: true,
            ignored: vec!["node_modules".into(), ".cache".into()],
        };

        let ignored: Vec<&str> = settings.ignored.iter().map(String::as_str).collect();
        let summary = scan_directory(&folder.path, Some(ignored)).expect("scan with ignores");

        let paths = relative_paths(&summary);
        assert!(paths.contains(Path::new("notes.txt")));
        assert!(paths.contains(Path::new("photos/vacation.jpg")));
        assert!(paths.contains(Path::new("docs/readme.md")));
        assert!(paths.contains(Path::new("docs/drafts/wip.txt")));
        assert!(!paths.contains(Path::new("node_modules/pkg/index.js")));
        assert!(!paths.contains(Path::new(".cache/tmp.dat")));
        assert_eq!(summary.files.len(), 4);
    }

    #[test]
    fn ignored_names_only_skip_directories_not_matching_files() {
        let dir = TempDir::new().expect("tempdir");
        write_file(dir.path(), "node_modules", b"not a directory");
        write_file(dir.path(), "keep/file.txt", b"keep me");

        let summary =
            scan_directory(dir.path(), Some(vec!["node_modules"])).expect("scan");

        let paths = relative_paths(&summary);
        assert!(paths.contains(Path::new("node_modules")));
        assert!(paths.contains(Path::new("keep/file.txt")));
        assert_eq!(summary.files.len(), 2);
    }

    #[test]
    fn records_relative_path_name_extension_and_size() {
        let dir = TempDir::new().expect("tempdir");
        write_file(dir.path(), "docs/report.pdf", b"pdf-data");

        let summary = scan_directory(dir.path(), None).expect("scan");
        let file = find_file(&summary, "docs/report.pdf");

        assert_eq!(file.path, Path::new("docs/report.pdf"));
        assert_eq!(file.name, "report.pdf");
        assert_eq!(file.extension.as_deref(), Some("pdf"));
        assert_eq!(file.size_bytes, b"pdf-data".len() as u64);
        assert!(file.modified.is_some());
        assert!(!file.hash.is_empty());
    }

    #[test]
    fn hashes_match_blake3_of_file_contents() {
        let dir = TempDir::new().expect("tempdir");
        let contents = b"content for hashing";
        write_file(dir.path(), "data.bin", contents);

        let summary = scan_directory(dir.path(), None).expect("scan");
        let file = find_file(&summary, "data.bin");

        let expected = blake3::hash(contents).to_hex().to_string();
        assert_eq!(file.hash, expected);
    }

    #[test]
    fn total_bytes_sums_all_discovered_files() {
        let dir = TempDir::new().expect("tempdir");
        write_file(dir.path(), "a.txt", b"aaa");
        write_file(dir.path(), "nested/b.txt", b"bbbb");

        let summary = scan_directory(dir.path(), None).expect("scan");

        assert_eq!(summary.total_bytes, 7);
        assert_eq!(
            summary.files.iter().map(|f| f.size_bytes).sum::<u64>(),
            summary.total_bytes
        );
    }

    #[test]
    fn does_not_follow_symlinked_directories() {
        let dir = TempDir::new().expect("tempdir");
        let outside = TempDir::new().expect("outside tempdir");
        write_file(outside.path(), "secret.txt", b"should not be scanned");
        write_file(dir.path(), "visible.txt", b"ok");

        let link = dir.path().join("linked");
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.path(), &link).expect("create symlink");
        #[cfg(not(unix))]
        {
            let _ = (outside, link);
            return;
        }

        let summary = scan_directory(dir.path(), None).expect("scan");
        let paths = relative_paths(&summary);

        assert!(paths.contains(Path::new("visible.txt")));
        assert!(!paths.iter().any(|p| p.ends_with("secret.txt")));
        assert_eq!(summary.files.len(), 1);
    }

    #[test]
    fn returns_error_for_missing_path() {
        let missing = PathBuf::from("/tmp/my-share-does-not-exist-watch-root");
        let result = scan_directory(&missing, None);
        assert!(result.is_err());
    }

    #[test]
    fn disabled_watched_folder_path_can_still_be_scanned_explicitly() {
        // Scanning is separate from the enabled flag; callers decide whether to scan.
        let dir = watched_tree();
        let mut folder = WatchedFolder::new(dir.path());
        folder.enabled = false;

        let summary = scan_directory(&folder.path, Some(vec!["node_modules", ".cache"]))
            .expect("explicit scan of disabled folder");

        assert_eq!(summary.files.len(), 4);
    }
}
