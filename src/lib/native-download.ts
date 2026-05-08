import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Save a file. On Android (Capacitor) writes into Documents/Khata
 * (and tries Downloads/Khata first when available). On web, triggers
 * a normal browser download.
 *
 * For text/JSON/CSV pass a string; for binary (PDF) pass a Blob/Uint8Array.
 */
export async function saveFile(
  filename: string,
  data: string | Blob | Uint8Array,
  mime: string,
): Promise<{ path?: string }> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");

    // Convert to base64 for binary, plain string for text.
    const isBinary = data instanceof Blob || data instanceof Uint8Array;
    let payload: string;
    let encoding: "utf8" | undefined;

    if (isBinary) {
      const buf = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
      payload = uint8ToBase64(buf);
    } else {
      payload = data as string;
      encoding = "utf8";
    }

    const folder = "Khata";
    const path = `${folder}/${filename}`;

    // Try ExternalStorage (Downloads-adjacent) first; fall back to Documents.
    const dirsToTry = [
      (Directory as any).ExternalStorage,
      Directory.Documents,
      Directory.Data,
    ].filter(Boolean);

    let lastError: any = null;
    for (const directory of dirsToTry) {
      try {
        const result = await Filesystem.writeFile({
          path,
          data: payload,
          directory,
          recursive: true,
          ...(encoding ? { encoding: encoding as any } : {}),
        });
        return { path: result.uri };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error("Failed to save file");
  }

  // Web fallback
  const blob = data instanceof Blob ? data : new Blob([data as any], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return {};
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}
