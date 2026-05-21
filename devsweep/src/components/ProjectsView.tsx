import { useState } from "react";
import type { AppConfig, Project } from "../lib/types";
import { pickFolder } from "../lib/picker";

interface Props {
  config: AppConfig;
  update: (patch: Partial<AppConfig>) => void;
  toast: (msg: string, kind?: "success" | "error") => void;
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lastSegment(p: string) {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

export default function ProjectsView({ config, update, toast }: Props) {
  const [manualPath, setManualPath] = useState("");
  const [manualName, setManualName] = useState("");

  async function addViaPicker() {
    const folder = await pickFolder("Pick a project folder");
    if (!folder) return;
    addProject(folder);
  }

  function addProject(path: string, name?: string) {
    const p = path.trim();
    if (!p) return;
    if (config.projects.some((x) => x.path === p)) {
      toast("Project already added", "error");
      return;
    }
    const project: Project = {
      id: makeId(),
      name: name?.trim() || lastSegment(p),
      path: p,
      addedAt: Date.now(),
    };
    update({ projects: [...config.projects, project] });
    toast("Project added", "success");
    setManualPath("");
    setManualName("");
  }

  function removeProject(id: string) {
    update({ projects: config.projects.filter((p) => p.id !== id) });
  }

  return (
    <>
      <div className="card">
        <h2>Add a project</h2>
        <p className="hint">
          Projects are scanned for dependency folders. Add as many as you like —
          everything is stored locally in your browser-style settings
          (localStorage).
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={addViaPicker}>
            Choose folder…
          </button>
          <span className="hint" style={{ marginLeft: 4 }}>
            or type a path:
          </span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            placeholder="Display name (optional)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <input
            className="input"
            placeholder="/path/to/project"
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => addProject(manualPath, manualName)}
            disabled={!manualPath.trim()}
          >
            Add
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Configured projects</h2>
        <p className="hint">{config.projects.length} project(s)</p>
        {config.projects.length === 0 ? (
          <div className="empty">
            No projects yet — add a folder above to start sweeping.
          </div>
        ) : (
          <div className="list">
            {config.projects.map((p) => (
              <div key={p.id} className="list-item">
                <div className="grow">
                  <div className="name">{p.name}</div>
                  <div className="path" title={p.path}>
                    {p.path}
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => removeProject(p.id)}
                  title="Remove project"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
