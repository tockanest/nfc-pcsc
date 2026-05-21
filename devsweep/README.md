# DevSweep

A cross-platform desktop app **and** CLI that reclaims disk space by removing
heavy dev-dependency / build folders from your projects:
`node_modules`, `target` (Rust), `.venv`, `__pycache__`, `dist`, `build`,
`.next`, `.nuxt`, `.gradle`, `Pods`, `DerivedData`, and anything else you
want to add.

Built with [Tauri 2](https://tauri.app/), React + TypeScript, and Rust.

![DevSweep](src-tauri/icons/128x128.png)

## Features

- **Nice UI** — dark/light themes, KPI cards, filterable hit list, bulk select,
  per-row delete, confirmation modal, toast notifications.
- **CLI mode** — the same binary works headless: `devsweep scan ~/code`,
  `devsweep clean ~/code -y`, `devsweep targets`. Add to `PATH` and use it
  from your shell.
- **Recursive scan** — for every configured project, DevSweep walks every
  subdirectory and reports each matching dependency folder along with its
  size and file count.
- **Configurable** — per-project list, ignored paths, glob ignore patterns,
  and custom target folder names; all stored in `localStorage`.
- **Easily exportable** — Settings → "Export config" produces a JSON file you
  can move to another machine and re-import.
- **Safe by default** — system roots like `/`, `/etc`, `C:\Windows` are
  hard-refused; symbolic links are not followed unless you opt in; deletions
  prompt for confirmation unless explicitly skipped.

### Architecture

| Concern                        | Lives in           |
| ------------------------------ | ------------------ |
| Folder scanning & deletion     | Rust (`src-tauri`) |
| Configuration & persistence    | TypeScript + `localStorage` |
| Tauri IPC commands             | `scan_paths`, `delete_paths`, `get_default_targets`, `inspect_path` |

The frontend never touches the filesystem itself — it only hands user-chosen
roots/options to Rust and renders results.

## Install

### Build from source

Prerequisites:

- Rust 1.85+ (use `rustup default stable`)
- Node.js 18+ and npm
- On Linux: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libsoup-3.0-dev pkg-config build-essential`
- On macOS: Xcode command-line tools
- On Windows: WebView2 (preinstalled on Win11) and the MSVC build tools

```bash
git clone <this-repo>
cd devsweep
npm install
npm run tauri:build           # produces a desktop bundle (.dmg / .msi / .deb / .AppImage)
# or, just the binary:
npm run tauri -- build --no-bundle
```

The resulting binary lives at `src-tauri/target/release/devsweep`
(`.exe` on Windows). It contains both the GUI and the CLI.

### Add it to your `PATH`

**Linux / macOS**

```bash
# pick any directory already on your PATH; ~/.local/bin is a good choice
mkdir -p ~/.local/bin
cp src-tauri/target/release/devsweep ~/.local/bin/devsweep
# make sure ~/.local/bin is on your PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

**Windows (PowerShell)**

```powershell
$dest = "$env:LOCALAPPDATA\DevSweep"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item src-tauri\target\release\devsweep.exe $dest
[Environment]::SetEnvironmentVariable("Path", "$env:Path;$dest", "User")
```

Now `devsweep` is available globally.

## CLI usage

```bash
# show every dep folder under one or more roots
devsweep scan ~/code ~/work

# JSON output for scripting
devsweep scan ~/code --json

# clean with confirmation
devsweep clean ~/code

# automate — no prompt
devsweep clean ~/code -y

# only specific targets
devsweep clean ~/code -t node_modules,target

# ignore some paths or glob patterns
devsweep clean ~/code -i ~/code/keep-me --ignore-glob '**/.git'

# dry run
devsweep clean ~/code --dry-run

# show the default list of target folders
devsweep targets

# launch the GUI (default when no subcommand is given)
devsweep
```

## GUI walkthrough

1. **Projects tab** — add the parent folders you'd like DevSweep to scan.
2. **Settings tab** — tweak target folder names, ignored paths, glob
   patterns, behavior flags, and theme. Export/import the whole config as
   JSON.
3. **Scan & Clean tab** — press *Scan now*. Review the table, filter, select
   the rows you want gone, hit *Delete selected*. A confirmation modal lists
   every path before anything is removed.

## Exporting your configuration

Settings → "Export config" downloads `devsweep-config-<timestamp>.json`
containing your projects, ignored paths, glob patterns, target list, and
preferences. Drop the same file back into "Import config" on another machine
to clone your setup.

## Safety notes

- DevSweep refuses to delete a small list of system-critical roots (`/`,
  `/etc`, `/home`, `/usr`, `C:\Windows`, etc.) even if explicitly asked.
- Symbolic links are not followed by default; toggle "Follow symbolic links"
  in Settings if you understand the risk.
- All deletions go through Rust's `std::fs::remove_dir_all`. Nothing is
  moved to the OS trash — be sure before you click *Delete permanently*.

## Development

```bash
npm install
npm run tauri:dev      # GUI + hot reload
npm run typecheck      # frontend typecheck only
cd src-tauri && cargo test
```

## License

MIT
