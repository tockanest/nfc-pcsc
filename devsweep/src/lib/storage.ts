import type { AppConfig } from "./types";

const STORAGE_KEY = "devsweep.config.v1";

export function loadConfig(): Partial<AppConfig> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppConfig>;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("Failed to persist config:", err);
  }
}

export function exportConfigJSON(config: AppConfig): string {
  return JSON.stringify(config, null, 2);
}

export function importConfigJSON(text: string): AppConfig {
  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Configuration must be a JSON object");
  }
  return parsed as AppConfig;
}

export function downloadAsFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
