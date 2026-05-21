use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

/// A folder that matched one of the configured dependency-folder names.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanHit {
    pub path: String,
    pub kind: String,
    pub size_bytes: u64,
    pub item_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanOptions {
    pub roots: Vec<String>,
    pub target_names: Vec<String>,
    pub ignored_paths: Vec<String>,
    pub ignored_globs: Vec<String>,
    pub follow_symlinks: bool,
    pub max_depth: Option<usize>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            roots: Vec::new(),
            target_names: default_target_names(),
            ignored_paths: Vec::new(),
            ignored_globs: Vec::new(),
            follow_symlinks: false,
            max_depth: None,
        }
    }
}

pub fn default_target_names() -> Vec<String> {
    [
        "node_modules",
        "target",
        ".venv",
        "venv",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        "dist",
        "build",
        "out",
        ".next",
        ".nuxt",
        ".svelte-kit",
        ".turbo",
        ".parcel-cache",
        ".cache",
        ".gradle",
        ".idea",
        "Pods",
        "DerivedData",
        "bin",
        "obj",
        "vendor",
        "deps",
        "_build",
        ".angular",
        ".expo",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

fn is_ignored(path: &Path, ignored_paths: &[PathBuf], ignored_globs: &[String]) -> bool {
    for ignored in ignored_paths {
        if path.starts_with(ignored) {
            return true;
        }
    }
    let path_str = path.to_string_lossy();
    for pat in ignored_globs {
        if pat.is_empty() {
            continue;
        }
        if simple_glob_match(pat, &path_str) {
            return true;
        }
    }
    false
}

/// Minimal glob matcher supporting `*` (any chars except path sep) and `**` (any chars).
/// Good enough for user-supplied path patterns without pulling another crate.
fn simple_glob_match(pattern: &str, text: &str) -> bool {
    fn inner(pat: &[u8], text: &[u8]) -> bool {
        let (mut pi, mut ti) = (0usize, 0usize);
        let (mut star_pi, mut star_ti): (Option<usize>, usize) = (None, 0);
        while ti < text.len() {
            if pi < pat.len() {
                let c = pat[pi];
                if c == b'*' {
                    let double = pi + 1 < pat.len() && pat[pi + 1] == b'*';
                    star_pi = Some(pi);
                    star_ti = ti;
                    pi += if double { 2 } else { 1 };
                    continue;
                }
                if c == b'?' || c == text[ti] {
                    pi += 1;
                    ti += 1;
                    continue;
                }
            }
            if let Some(sp) = star_pi {
                pi = sp + 1;
                star_ti += 1;
                ti = star_ti;
            } else {
                return false;
            }
        }
        while pi < pat.len() && pat[pi] == b'*' {
            pi += 1;
        }
        pi == pat.len()
    }
    inner(pattern.as_bytes(), text.as_bytes())
}

/// Recursively scan `roots` looking for directories whose final path-segment
/// matches one of `target_names`. Matched directories are not descended into.
pub fn scan(options: &ScanOptions) -> Vec<ScanHit> {
    let ignored_paths: Vec<PathBuf> =
        options.ignored_paths.iter().map(PathBuf::from).collect();

    let mut hits: Vec<ScanHit> = Vec::new();

    for root in &options.roots {
        let root = PathBuf::from(root);
        if !root.exists() {
            continue;
        }

        let mut walker = WalkDir::new(&root)
            .follow_links(options.follow_symlinks)
            .into_iter();
        if let Some(d) = options.max_depth {
            walker = WalkDir::new(&root)
                .follow_links(options.follow_symlinks)
                .max_depth(d)
                .into_iter();
        }

        loop {
            let entry = match walker.next() {
                Some(Ok(e)) => e,
                Some(Err(_)) => continue,
                None => break,
            };

            if !entry.file_type().is_dir() {
                continue;
            }

            let path = entry.path();
            let name = match path.file_name().and_then(|s| s.to_str()) {
                Some(n) => n,
                None => continue,
            };

            if is_ignored(path, &ignored_paths, &options.ignored_globs) {
                walker.skip_current_dir();
                continue;
            }

            if options.target_names.iter().any(|t| t == name) {
                let (size_bytes, item_count) = measure_dir(path);
                hits.push(ScanHit {
                    path: path.to_string_lossy().into_owned(),
                    kind: name.to_string(),
                    size_bytes,
                    item_count,
                });
                walker.skip_current_dir();
            }
        }
    }

    hits.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    hits
}

/// Returns (total_size_in_bytes, total_file_count).
pub fn measure_dir(path: &Path) -> (u64, u64) {
    let mut total: u64 = 0;
    let mut count: u64 = 0;
    for entry in WalkDir::new(path).into_iter().flatten() {
        if entry.file_type().is_file() {
            if let Ok(md) = entry.metadata() {
                total = total.saturating_add(md.len());
            }
            count = count.saturating_add(1);
        }
    }
    (total, count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn tmpdir() -> PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let mut p = std::env::temp_dir();
        p.push(format!(
            "devsweep-test-{}-{}-{}",
            std::process::id(),
            nanos,
            id
        ));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn write(p: &Path, content: &[u8]) {
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut f = fs::File::create(p).unwrap();
        f.write_all(content).unwrap();
    }

    #[test]
    fn scan_finds_node_modules_recursively() {
        let root = tmpdir();
        write(&root.join("apps/web/node_modules/foo/index.js"), b"hi");
        write(&root.join("apps/api/node_modules/bar/index.js"), b"hello");
        write(&root.join("apps/api/src/main.rs"), b"fn main() {}");
        write(&root.join("packages/ui/node_modules/lib/a.js"), b"a");

        let opts = ScanOptions {
            roots: vec![root.to_string_lossy().to_string()],
            target_names: vec!["node_modules".into()],
            ..Default::default()
        };
        let hits = scan(&opts);
        assert_eq!(hits.len(), 3);
        for h in &hits {
            assert!(h.path.ends_with("node_modules"));
            assert!(h.item_count >= 1);
            assert!(h.size_bytes > 0);
        }
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn ignored_paths_are_skipped() {
        let root = tmpdir();
        write(&root.join("a/node_modules/x"), b"x");
        write(&root.join("b/node_modules/x"), b"y");
        let opts = ScanOptions {
            roots: vec![root.to_string_lossy().to_string()],
            target_names: vec!["node_modules".into()],
            ignored_paths: vec![root.join("a").to_string_lossy().to_string()],
            ..Default::default()
        };
        let hits = scan(&opts);
        assert_eq!(hits.len(), 1);
        assert!(hits[0].path.contains("/b/"));
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn glob_match_basics() {
        assert!(simple_glob_match("*.log", "error.log"));
        assert!(simple_glob_match("**/node_modules", "/home/u/p/node_modules"));
        assert!(!simple_glob_match("*.log", "error.txt"));
    }
}
