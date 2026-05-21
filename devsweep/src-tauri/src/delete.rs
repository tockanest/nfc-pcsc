use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub path: String,
    pub ok: bool,
    pub freed_bytes: u64,
    pub error: Option<String>,
}

/// Hard guard list — we refuse to ever touch these paths even if asked.
/// Prevents catastrophic mistakes (e.g. accidentally passing `/`).
fn is_protected(path: &Path) -> bool {
    if path.parent().is_none() {
        return true;
    }
    if let Some(home) = dirs_home() {
        if path == home.as_path() {
            return true;
        }
    }
    let s = path.to_string_lossy();
    matches!(
        s.as_ref(),
        "/" | "/home"
            | "/root"
            | "/etc"
            | "/usr"
            | "/var"
            | "/bin"
            | "/sbin"
            | "/lib"
            | "/opt"
            | "/boot"
            | "/sys"
            | "/proc"
            | "/dev"
            | "C:\\"
            | "C:\\Windows"
            | "C:\\Users"
            | "C:\\Program Files"
            | "C:\\Program Files (x86)"
    )
}

fn dirs_home() -> Option<PathBuf> {
    #[cfg(unix)]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE").map(PathBuf::from)
    }
}

pub fn delete_one(path: &Path) -> DeleteResult {
    let freed = crate::scan::measure_dir(path).0;
    let path_str = path.to_string_lossy().into_owned();

    if is_protected(path) {
        return DeleteResult {
            path: path_str,
            ok: false,
            freed_bytes: 0,
            error: Some("refusing to delete protected path".into()),
        };
    }

    match std::fs::remove_dir_all(path) {
        Ok(()) => DeleteResult {
            path: path_str,
            ok: true,
            freed_bytes: freed,
            error: None,
        },
        Err(e) => DeleteResult {
            path: path_str,
            ok: false,
            freed_bytes: 0,
            error: Some(e.to_string()),
        },
    }
}

pub fn delete_many(paths: &[String]) -> Vec<DeleteResult> {
    paths
        .iter()
        .map(|p| delete_one(Path::new(p)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn deletes_directory_and_reports_freed() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let mut p = std::env::temp_dir();
        p.push(format!("devsweep-del-{}-{}", std::process::id(), nanos));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(p.join("inner")).unwrap();
        std::fs::write(p.join("inner/a.txt"), b"hello world").unwrap();

        let res = delete_one(&p);
        assert!(res.ok, "delete failed: {:?}", res.error);
        assert!(res.freed_bytes >= 11);
        assert!(!p.exists());
    }

    #[test]
    fn refuses_protected() {
        let res = delete_one(Path::new("/"));
        assert!(!res.ok);
    }
}
