use std::path::Path;

use my_share::scanner::scan_directory;

fn main() {
    let root = std::env::args().nth(1).unwrap_or_else(|| ".".to_string());

    match scan_directory(Path::new(&root), None) {
        Ok(summary) => {
            println!("Files: {}", summary.files.len());
            println!("Total bytes: {}", summary.total_bytes);

            for file in &summary.files {
                println!(
                    "{:?} | {} bytes | {}",
                    file.path, file.size_bytes, file.hash
                );
            }
        }
        Err(error) => {
            eprintln!("Scan failed: {error}");
        }
    }
}
