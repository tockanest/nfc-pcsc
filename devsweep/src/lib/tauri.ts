import { invoke } from "@tauri-apps/api/core";
import type { DeleteResult, ScanHit } from "./types";

export interface ScanOptionsPayload {
  roots: string[];
  target_names: string[];
  ignored_paths: string[];
  ignored_globs: string[];
  follow_symlinks: boolean;
  max_depth: number | null;
}

export async function scanPaths(options: ScanOptionsPayload): Promise<ScanHit[]> {
  return invoke<ScanHit[]>("scan_paths", { options });
}

export async function deletePaths(paths: string[]): Promise<DeleteResult[]> {
  return invoke<DeleteResult[]>("delete_paths", { paths });
}

export async function getDefaultTargets(): Promise<string[]> {
  return invoke<string[]>("get_default_targets");
}

export interface PathInfo {
  path: string;
  exists: boolean;
  is_dir: boolean;
}

export async function inspectPath(path: string): Promise<PathInfo> {
  return invoke<PathInfo>("inspect_path", { path });
}
