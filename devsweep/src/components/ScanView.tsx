import { useMemo, useState } from "react";
import type { AppConfig, ScanHit } from "../lib/types";
import { deletePaths, scanPaths } from "../lib/tauri";
import { formatBytes, formatCount } from "../lib/format";

interface Props {
  config: AppConfig;
  toast: (msg: string, kind?: "success" | "error") => void;
  setBusy: (busy: boolean, label?: string) => void;
}

export default function ScanView({ config, toast, setBusy }: Props) {
  const [hits, setHits] = useState<ScanHit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ScanHit[] | null>(null);

  const hasProjects = config.projects.length > 0;

  const filtered = useMemo(() => {
    if (!filter.trim()) return hits;
    const f = filter.toLowerCase();
    return hits.filter(
      (h) => h.path.toLowerCase().includes(f) || h.kind.toLowerCase().includes(f)
    );
  }, [hits, filter]);

  const summary = useMemo(() => {
    const totalSize = hits.reduce((s, h) => s + h.size_bytes, 0);
    const totalCount = hits.reduce((s, h) => s + h.item_count, 0);
    const selectedSize = hits
      .filter((h) => selected.has(h.path))
      .reduce((s, h) => s + h.size_bytes, 0);
    return { totalSize, totalCount, selectedSize };
  }, [hits, selected]);

  async function runScan() {
    if (!hasProjects) {
      toast("Add a project first (Projects tab)", "error");
      return;
    }
    setBusy(true, "Scanning…");
    try {
      const result = await scanPaths({
        roots: config.projects.map((p) => p.path),
        target_names: config.targetNames,
        ignored_paths: config.ignoredPaths,
        ignored_globs: config.ignoredGlobs,
        follow_symlinks: config.followSymlinks,
        max_depth: null,
      });
      setHits(result);
      setSelected(new Set(result.map((r) => r.path)));
      toast(`Found ${result.length} folder(s)`, "success");
    } catch (err) {
      toast(`Scan failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const allSelected = filtered.every((h) => prev.has(h.path));
      const next = new Set(prev);
      if (allSelected) filtered.forEach((h) => next.delete(h.path));
      else filtered.forEach((h) => next.add(h.path));
      return next;
    });
  }

  async function performDelete(targets: ScanHit[]) {
    setBusy(true, "Deleting…");
    try {
      const results = await deletePaths(targets.map((t) => t.path));
      const okCount = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      const freed = results.reduce((s, r) => s + (r.ok ? r.freed_bytes : 0), 0);
      const okPaths = new Set(results.filter((r) => r.ok).map((r) => r.path));
      setHits((prev) => prev.filter((h) => !okPaths.has(h.path)));
      setSelected((prev) => {
        const next = new Set(prev);
        okPaths.forEach((p) => next.delete(p));
        return next;
      });
      toast(
        `Deleted ${okCount}/${results.length} — freed ${formatBytes(freed)}${
          failed.length ? ` (${failed.length} failed)` : ""
        }`,
        failed.length ? "error" : "success"
      );
    } catch (err) {
      toast(`Delete failed: ${String(err)}`, "error");
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  }

  function requestDelete(targets: ScanHit[]) {
    if (targets.length === 0) return;
    if (config.confirmBeforeDelete) {
      setPendingDelete(targets);
    } else {
      void performDelete(targets);
    }
  }

  const selectedHits = hits.filter((h) => selected.has(h.path));

  return (
    <>
      <div className="card">
        <h2>Sweep dependency folders</h2>
        <p className="hint">
          Scans every configured project recursively for the target folder names
          (e.g. <code>node_modules</code>, <code>target</code>, <code>.venv</code>
          ). Matched folders are listed below — select the ones you want gone.
        </p>
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={runScan}
            disabled={!hasProjects}
          >
            ✦ Scan now
          </button>
          <span className="hint">
            {config.projects.length} project(s), {config.targetNames.length}{" "}
            target name(s), {config.ignoredPaths.length} ignored path(s)
          </span>
        </div>
        {!hasProjects && (
          <div className="empty" style={{ marginTop: 14 }}>
            Add at least one project on the Projects tab to begin.
          </div>
        )}
      </div>

      {hits.length > 0 && (
        <>
          <div className="summary">
            <div className="kpi">
              <div className="label">Matches</div>
              <div className="value">{hits.length}</div>
            </div>
            <div className="kpi accent">
              <div className="label">Reclaimable</div>
              <div className="value">{formatBytes(summary.totalSize)}</div>
            </div>
            <div className="kpi">
              <div className="label">Total files</div>
              <div className="value">{formatCount(summary.totalCount)}</div>
            </div>
            <div className="kpi">
              <div className="label">Selected</div>
              <div className="value">
                {selected.size} · {formatBytes(summary.selectedSize)}
              </div>
            </div>
          </div>

          <div className="hits-toolbar">
            <input
              className="input"
              placeholder="Filter by path or kind…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <button className="btn" onClick={toggleAllVisible}>
              {filtered.every((h) => selected.has(h.path))
                ? "Deselect visible"
                : "Select visible"}
            </button>
            <span className="nav-spacer" />
            <button
              className="btn btn-danger"
              onClick={() => requestDelete(selectedHits)}
              disabled={selectedHits.length === 0}
            >
              Delete {selectedHits.length} selected ({formatBytes(summary.selectedSize)})
            </button>
          </div>

          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="hits-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Path</th>
                  <th style={{ width: 120 }}>Kind</th>
                  <th style={{ width: 110 }}>Files</th>
                  <th style={{ width: 110 }}>Size</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.path}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selected.has(h.path)}
                        onChange={() => toggle(h.path)}
                      />
                    </td>
                    <td className="path" title={h.path}>
                      {h.path}
                    </td>
                    <td>
                      <span className="kind-pill">{h.kind}</span>
                    </td>
                    <td className="size">{formatCount(h.item_count)}</td>
                    <td className="size">{formatBytes(h.size_bytes)}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={() => requestDelete([h])}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pendingDelete && (
        <div className="modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm deletion</h3>
            <p className="hint">
              You're about to permanently delete{" "}
              <strong>{pendingDelete.length} folder(s)</strong> totaling{" "}
              <strong>
                {formatBytes(
                  pendingDelete.reduce((s, h) => s + h.size_bytes, 0)
                )}
              </strong>
              . This action cannot be undone.
            </p>
            <div
              style={{
                maxHeight: 180,
                overflow: "auto",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 12,
                color: "var(--text-dim)",
              }}
            >
              {pendingDelete.map((h) => (
                <div key={h.path}>{h.path}</div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => performDelete(pendingDelete)}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
