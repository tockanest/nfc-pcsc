export interface Project {
  id: string;
  name: string;
  path: string;
  addedAt: number;
}

export interface AppConfig {
  projects: Project[];
  ignoredPaths: string[];
  ignoredGlobs: string[];
  targetNames: string[];
  followSymlinks: boolean;
  confirmBeforeDelete: boolean;
  theme: "system" | "light" | "dark";
}

export interface ScanHit {
  path: string;
  kind: string;
  size_bytes: number;
  item_count: number;
}

export interface DeleteResult {
  path: string;
  ok: boolean;
  freed_bytes: number;
  error: string | null;
}

export const defaultConfig = (defaultTargets: string[]): AppConfig => ({
  projects: [],
  ignoredPaths: [],
  ignoredGlobs: [],
  targetNames: defaultTargets,
  followSymlinks: false,
  confirmBeforeDelete: true,
  theme: "system",
});
