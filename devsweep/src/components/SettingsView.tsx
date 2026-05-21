import { useRef, useState } from "react";
import type { AppConfig } from "../lib/types";
import { pickFolders } from "../lib/picker";
import {
  downloadAsFile,
  exportConfigJSON,
  importConfigJSON,
} from "../lib/storage";

interface Props {
  config: AppConfig;
  defaultTargets: string[];
  update: (patch: Partial<AppConfig>) => void;
  reset: () => void;
  toast: (msg: string, kind?: "success" | "error") => void;
}

export default function SettingsView({
  config,
  defaultTargets,
  update,
  reset,
  toast,
}: Props) {
  const [newTarget, setNewTarget] = useState("");
  const [newGlob, setNewGlob] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function addIgnoredPath() {
    const folders = await pickFolders("Pick folder(s) to ignore");
    if (folders.length === 0) return;
    const set = new Set([...config.ignoredPaths, ...folders]);
    update({ ignoredPaths: Array.from(set) });
  }

  function removeIgnoredPath(p: string) {
    update({ ignoredPaths: config.ignoredPaths.filter((x) => x !== p) });
  }

  function addTarget() {
    const t = newTarget.trim();
    if (!t) return;
    if (config.targetNames.includes(t)) {
      toast(`"${t}" already in list`, "error");
      return;
    }
    update({ targetNames: [...config.targetNames, t] });
    setNewTarget("");
  }

  function removeTarget(t: string) {
    update({ targetNames: config.targetNames.filter((x) => x !== t) });
  }

  function addGlob() {
    const g = newGlob.trim();
    if (!g) return;
    if (config.ignoredGlobs.includes(g)) {
      toast("Pattern already added", "error");
      return;
    }
    update({ ignoredGlobs: [...config.ignoredGlobs, g] });
    setNewGlob("");
  }

  function removeGlob(g: string) {
    update({ ignoredGlobs: config.ignoredGlobs.filter((x) => x !== g) });
  }

  function exportConfig() {
    const json = exportConfigJSON(config);
    downloadAsFile(`devsweep-config-${Date.now()}.json`, json);
    toast("Configuration exported", "success");
  }

  function importConfig(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = importConfigJSON(String(reader.result || ""));
        update({
          projects: parsed.projects ?? config.projects,
          ignoredPaths: parsed.ignoredPaths ?? config.ignoredPaths,
          ignoredGlobs: parsed.ignoredGlobs ?? config.ignoredGlobs,
          targetNames: parsed.targetNames ?? config.targetNames,
          followSymlinks: parsed.followSymlinks ?? config.followSymlinks,
          confirmBeforeDelete:
            parsed.confirmBeforeDelete ?? config.confirmBeforeDelete,
          theme: parsed.theme ?? config.theme,
        });
        toast("Configuration imported", "success");
      } catch (err) {
        toast(`Import failed: ${(err as Error).message}`, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>Target folder names</h2>
          <p className="hint">
            Directories whose final name matches any entry below are flagged for
            cleanup.
          </p>
          <div className="tags">
            {config.targetNames.map((t) => (
              <span key={t} className="tag">
                {t}
                <button onClick={() => removeTarget(t)} title="Remove">
                  ✕
                </button>
              </span>
            ))}
            {config.targetNames.length === 0 && (
              <span className="hint">No targets — add one below.</span>
            )}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <input
              className="input"
              placeholder="e.g. node_modules"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTarget()}
            />
            <button className="btn" onClick={addTarget} disabled={!newTarget.trim()}>
              Add target
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn btn-ghost"
              onClick={() => update({ targetNames: defaultTargets })}
            >
              Restore defaults
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Ignored paths</h2>
          <p className="hint">
            Folders listed here (and everything inside them) are skipped during
            scans.
          </p>
          {config.ignoredPaths.length === 0 ? (
            <div className="empty">No ignored paths.</div>
          ) : (
            <div className="list">
              {config.ignoredPaths.map((p) => (
                <div key={p} className="list-item">
                  <div className="grow">
                    <div className="path" title={p}>
                      {p}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => removeIgnoredPath(p)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={addIgnoredPath}>
              Add folder…
            </button>
          </div>

          <h2 style={{ marginTop: 20 }}>Ignore patterns (globs)</h2>
          <p className="hint">
            Use <code>*</code> for any segment and <code>**</code> for any depth.
            Example: <code>**/.git</code>.
          </p>
          <div className="tags">
            {config.ignoredGlobs.map((g) => (
              <span key={g} className="tag">
                {g}
                <button onClick={() => removeGlob(g)} title="Remove">
                  ✕
                </button>
              </span>
            ))}
            {config.ignoredGlobs.length === 0 && (
              <span className="hint">No glob patterns.</span>
            )}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <input
              className="input"
              placeholder="**/some-pattern"
              value={newGlob}
              onChange={(e) => setNewGlob(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGlob()}
            />
            <button className="btn" onClick={addGlob} disabled={!newGlob.trim()}>
              Add pattern
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Behavior</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={config.followSymlinks}
            onChange={(e) => update({ followSymlinks: e.target.checked })}
          />
          Follow symbolic links during scan (off by default for safety)
        </label>
        <br />
        <label className="checkbox" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={config.confirmBeforeDelete}
            onChange={(e) => update({ confirmBeforeDelete: e.target.checked })}
          />
          Always confirm before deleting
        </label>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="hint">Theme:</span>
          <select
            className="input"
            value={config.theme}
            onChange={(e) =>
              update({ theme: e.target.value as AppConfig["theme"] })
            }
            style={{ maxWidth: 180 }}
          >
            <option value="system">Match system</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h2>Backup &amp; restore</h2>
        <p className="hint">
          Configuration is stored in localStorage. Export to take it with you.
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={exportConfig}>
            Export config
          </button>
          <button
            className="btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Import config
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={importConfig}
          />
          <span className="nav-spacer" />
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm("Reset all settings to defaults?")) reset();
            }}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}
