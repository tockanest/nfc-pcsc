import { open } from "@tauri-apps/plugin-dialog";

export async function pickFolder(title = "Pick a folder"): Promise<string | null> {
  const result = await open({
    title,
    directory: true,
    multiple: false,
    recursive: false,
  });
  if (typeof result === "string") return result;
  return null;
}

export async function pickFolders(title = "Pick folders"): Promise<string[]> {
  const result = await open({
    title,
    directory: true,
    multiple: true,
    recursive: false,
  });
  if (Array.isArray(result)) return result;
  if (typeof result === "string") return [result];
  return [];
}
