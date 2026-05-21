import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ProjectsView from "./components/ProjectsView";
import ScanView from "./components/ScanView";
import SettingsView from "./components/SettingsView";
import AboutView from "./components/AboutView";
import { defaultConfig, type AppConfig } from "./lib/types";
import { loadConfig, saveConfig } from "./lib/storage";
import { getDefaultTargets } from "./lib/tauri";

type Toast = { id: number; kind: "success" | "error"; msg: string };

const TITLES: Record<string, { title: string; sub: string }> = {
  scan: { title: "Scan & Clean", sub: "Find and remove heavy dev folders" },
  projects: {
    title: "Projects",
    sub: "Folders that DevSweep will scan recursively",
  },
  settings: {
    title: "Settings",
    sub: "Targets, ignored paths, and behavior",
  },
  about: { title: "About", sub: "How DevSweep works" },
};

export default function App() {
  const [defaultTargets, setDefaultTargets] = useState<string[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [view, setView] = useState<string>("scan");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusyState] = useState<{ on: boolean; label?: string }>({
    on: false,
  });
  const toastIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let targets: string[] = [];
      try {
        targets = await getDefaultTargets();
      } catch {
        targets = [
          "node_modules",
          "target",
          ".venv",
          "venv",
          "__pycache__",
          "dist",
          "build",
        ];
      }
      if (!mounted) return;
      setDefaultTargets(targets);
      const stored = loadConfig();
      const base = defaultConfig(targets);
      setConfig({ ...base, ...(stored ?? {}) });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (config) saveConfig(config);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const root = document.documentElement;
    root.classList.remove("theme-system", "theme-light", "theme-dark");
    root.classList.add(`theme-${config.theme}`);
  }, [config?.theme]);

  const update = useCallback(
    (patch: Partial<AppConfig>) =>
      setConfig((prev) => (prev ? { ...prev, ...patch } : prev)),
    []
  );

  const reset = useCallback(() => {
    setConfig(defaultConfig(defaultTargets));
  }, [defaultTargets]);

  const toast = useCallback(
    (msg: string, kind: "success" | "error" = "success") => {
      const id = ++toastIdRef.current;
      setToasts((t) => [...t, { id, kind, msg }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3800);
    },
    []
  );

  const setBusy = useCallback((on: boolean, label?: string) => {
    setBusyState({ on, label });
  }, []);

  if (!config) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
          color: "var(--text-faint)",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  const meta = TITLES[view] ?? TITLES.scan;

  return (
    <div className="app">
      <Sidebar active={view} onChange={setView} />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <div className="subtitle">{meta.sub}</div>
          </div>
          <div className="topbar-actions">
            {busy.on && (
              <span
                className="hint"
                style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
              >
                <span className="spinner" /> {busy.label ?? "Working…"}
              </span>
            )}
          </div>
        </div>
        <div className="content">
          {view === "scan" && (
            <ScanView config={config} toast={toast} setBusy={setBusy} />
          )}
          {view === "projects" && (
            <ProjectsView config={config} update={update} toast={toast} />
          )}
          {view === "settings" && (
            <SettingsView
              config={config}
              defaultTargets={defaultTargets}
              update={update}
              reset={reset}
              toast={toast}
            />
          )}
          {view === "about" && <AboutView />}
        </div>
        <div className="status-bar">
          {config.projects.length} project(s) · {config.targetNames.length}{" "}
          target(s) · {config.ignoredPaths.length} ignored path(s)
          {config.ignoredGlobs.length > 0 &&
            ` · ${config.ignoredGlobs.length} glob(s)`}
          <span style={{ marginLeft: "auto" }}>
            DevSweep · settings saved in localStorage
          </span>
        </div>
      </div>
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
