use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use clap::{Args, Parser, Subcommand};
use humansize::{format_size, BINARY};

use crate::scan::{default_target_names, scan, ScanOptions};

/// DevSweep — reclaim disk by sweeping away build/dependency folders.
#[derive(Debug, Parser)]
#[command(name = "devsweep", version, about, long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Scan one or more folders for dependency directories and print a report.
    Scan(ScanArgs),
    /// Scan and then delete every match (or only those matching --only).
    Clean(CleanArgs),
    /// Print the default list of target folder names.
    Targets,
    /// Launch the desktop UI (default if no subcommand is given).
    Ui,
}

#[derive(Debug, Args)]
pub struct ScanArgs {
    /// One or more root folders to scan recursively.
    #[arg(required = true)]
    pub roots: Vec<PathBuf>,

    /// Comma-separated dependency-folder names to look for.
    #[arg(short = 't', long, value_delimiter = ',')]
    pub targets: Option<Vec<String>>,

    /// Comma-separated absolute paths to skip entirely.
    #[arg(short = 'i', long, value_delimiter = ',')]
    pub ignore: Vec<PathBuf>,

    /// Comma-separated glob patterns to skip (supports * and **).
    #[arg(long, value_delimiter = ',')]
    pub ignore_glob: Vec<String>,

    /// Follow symbolic links while walking.
    #[arg(long)]
    pub follow_symlinks: bool,

    /// Output as JSON instead of a human report.
    #[arg(long)]
    pub json: bool,
}

#[derive(Debug, Args)]
pub struct CleanArgs {
    #[command(flatten)]
    pub scan: ScanArgs,

    /// Skip the interactive confirmation prompt.
    #[arg(short = 'y', long)]
    pub yes: bool,

    /// Show what would be deleted without doing it.
    #[arg(long)]
    pub dry_run: bool,
}

/// Returns `true` when the CLI handled the run and the process should exit
/// without launching the GUI; otherwise returns `false`.
pub fn run_cli() -> bool {
    let args: Vec<String> = std::env::args().collect();
    if args.len() <= 1 {
        return false;
    }

    let cli = match Cli::try_parse_from(&args) {
        Ok(c) => c,
        Err(e) => {
            let _ = e.print();
            std::process::exit(e.exit_code());
        }
    };

    match cli.command {
        None | Some(Command::Ui) => false,
        Some(Command::Targets) => {
            for t in default_target_names() {
                println!("{t}");
            }
            true
        }
        Some(Command::Scan(args)) => {
            let opts = build_options(&args);
            let hits = scan(&opts);
            if args.json {
                println!("{}", serde_json::to_string_pretty(&hits).unwrap());
            } else {
                print_report(&hits);
            }
            true
        }
        Some(Command::Clean(args)) => {
            let opts = build_options(&args.scan);
            let hits = scan(&opts);
            if hits.is_empty() {
                println!("No matches found.");
                return true;
            }

            print_report(&hits);

            if args.dry_run {
                println!("\n(dry run — nothing deleted)");
                return true;
            }

            if !args.yes && !confirm("\nDelete all of the above? [y/N]: ") {
                println!("Aborted.");
                return true;
            }

            let mut total_freed: u64 = 0;
            let mut failures = 0usize;
            for hit in &hits {
                let res = crate::delete::delete_one(std::path::Path::new(&hit.path));
                if res.ok {
                    total_freed += res.freed_bytes;
                    println!(
                        "  removed {} ({})",
                        hit.path,
                        format_size(hit.size_bytes, BINARY)
                    );
                } else {
                    failures += 1;
                    println!(
                        "  FAILED  {} — {}",
                        hit.path,
                        res.error.unwrap_or_default()
                    );
                }
            }
            println!(
                "\nDone. Freed {} across {} folder(s){}",
                format_size(total_freed, BINARY),
                hits.len() - failures,
                if failures > 0 {
                    format!(", {failures} failed")
                } else {
                    String::new()
                }
            );
            true
        }
    }
}

fn build_options(args: &ScanArgs) -> ScanOptions {
    ScanOptions {
        roots: args.roots.iter().map(|p| p.to_string_lossy().into_owned()).collect(),
        target_names: args.targets.clone().unwrap_or_else(default_target_names),
        ignored_paths: args
            .ignore
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect(),
        ignored_globs: args.ignore_glob.clone(),
        follow_symlinks: args.follow_symlinks,
        max_depth: None,
    }
}

fn print_report(hits: &[crate::scan::ScanHit]) {
    if hits.is_empty() {
        println!("No matches found.");
        return;
    }

    let mut total: u64 = 0;
    let path_w = hits
        .iter()
        .map(|h| h.path.chars().count())
        .max()
        .unwrap_or(20)
        .min(80);

    println!(
        "{:<path_w$}  {:>10}  {:>10}  {}",
        "PATH",
        "SIZE",
        "FILES",
        "KIND",
        path_w = path_w
    );
    println!("{}", "-".repeat(path_w + 36));
    for h in hits {
        total += h.size_bytes;
        let p = if h.path.chars().count() > path_w {
            format!("…{}", &h.path[h.path.len().saturating_sub(path_w - 1)..])
        } else {
            h.path.clone()
        };
        println!(
            "{:<path_w$}  {:>10}  {:>10}  {}",
            p,
            format_size(h.size_bytes, BINARY),
            h.item_count,
            h.kind,
            path_w = path_w
        );
    }
    println!(
        "\n{} match(es), reclaimable: {}",
        hits.len(),
        format_size(total, BINARY)
    );
}

fn confirm(prompt: &str) -> bool {
    print!("{prompt}");
    io::stdout().flush().ok();
    let stdin = io::stdin();
    let mut line = String::new();
    if stdin.lock().read_line(&mut line).is_err() {
        return false;
    }
    matches!(line.trim().to_lowercase().as_str(), "y" | "yes")
}
