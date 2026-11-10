use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

use rayon::prelude::*;

pub fn hash_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();

    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

pub fn hash_files_parallel(paths: &[std::path::PathBuf]) -> Vec<io::Result<String>> {
    paths.par_iter().map(|path| hash_file(path)).collect()
}
