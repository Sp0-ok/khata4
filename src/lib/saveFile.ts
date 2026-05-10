// Cross-platform file save.
// On Android (Capacitor) the first save asks the user where files should go
// (Documents or Downloads) and remembers the choice in settings. Subsequent
// saves write straight there without further prompts. On the web we fall back
// to a regular browser download.

import { toast } from "sonner";
import { db, getSettings, updateSettings } from "./db";

type SavableContent = string | Uint8Array | ArrayBuffer | Blob;

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

async function toBase64(content: SavableContent): Promise<string> {
  if (typeof content === "string") {
    if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(content)));
    // @ts-ignore — Buffer exists in some bundles
    return Buffer.from(content, "utf-8").toString("base64");
  }
  let bytes: Uint8Array;
  if (content instanceof Blob) {
    bytes = new Uint8Array(await content.arrayBuffer());
  } else if (content instanceof ArrayBuffer) {
    bytes = new Uint8Array(content);
  } else {
    bytes = content;
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

async function browserDownload(filename: string, mime: string, content: SavableContent) {
  const blob = content instanceof Blob ? content : new Blob([content as any], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function askFolderChoice(): Promise<"documents" | "downloads" | null> {
  return new Promise(resolve => {
    const evt = new CustomEvent<{
      resolve: (v: "documents" | "downloads" | null) => void;
    }>("hk:pick-folder", { detail: { resolve } });
    window.dispatchEvent(evt);
  });
}

/**
 * Save a file. On native, asks the user (once) where to save and remembers it.
 * On web, performs a normal browser download.
 */
export async function saveFile(
  filename: string,
  mime: string,
  content: SavableContent,
): Promise<void> {
  if (!isNative()) {
    await browserDownload(filename, mime, content);
    toast.success(`Saved ${filename}`);
    return;
  }

  let settings = await getSettings();
  let dir = settings.downloadDir as "documents" | "downloads" | undefined;
  if (!dir) {
    const choice = await askFolderChoice();
    if (!choice) return; // user cancelled
    dir = choice;
    await updateSettings({ downloadDir: choice });
    settings = await getSettings();
  }

  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await toBase64(content);
    const targetDir = dir === "downloads" ? Directory.ExternalStorage : Directory.Documents;
    const path = dir === "downloads" ? `Download/HisaabKitaab/${filename}` : `HisaabKitaab/${filename}`;
    await Filesystem.writeFile({
      path,
      data,
      directory: targetDir,
      recursive: true,
    });
    toast.success(`Saved to ${dir === "downloads" ? "Downloads" : "Documents"}/HisaabKitaab`);
  } catch (e: any) {
    console.error("[saveFile] native write failed", e);
    // Fallback so the user still ends up with the file.
    await browserDownload(filename, mime, content);
    toast.success(`Saved ${filename}`);
  }
}

/** Reset the remembered folder so the next save re-prompts. */
export async function resetSaveFolder() {
  await updateSettings({ downloadDir: undefined });
}

// Re-export so settings page can read the current value without importing db
export { db };
