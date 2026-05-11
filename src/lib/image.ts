// Robust image downscale that works reliably on Android WebView / Capacitor.
// Android file pickers can report odd sizes and some WebView builds reject
// blob: URLs, so decoding uses multiple paths before surfacing an error.

type DecodedImage = HTMLImageElement | ImageBitmap;

export async function downscaleImage(file: File, maxSize: number): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Choose an image file");
  const img = await decodeImage(file);
  try {
    return drawScaled(img, maxSize);
  } finally {
    if ("close" in img) img.close();
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    }
  } catch {
    // Fall through to data/blob URL based decoding.
  }

  try {
    return await loadFromDataUrl(file);
  } catch {
    try {
      return await loadFromBlob(file);
    } catch {
      throw new Error("Could not open this image. Try a JPG or PNG photo.");
    }
  }
}

function drawScaled(img: DecodedImage, maxSize: number): string {
  const iw = "naturalWidth" in img ? (img.naturalWidth || img.width) : img.width;
  const ih = "naturalHeight" in img ? (img.naturalHeight || img.height) : img.height;
  const ratio = Math.min(1, maxSize / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * ratio));
  const h = Math.max(1, Math.round(ih * ratio));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

function loadFromBlob(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return loadImage(url).finally(() => URL.revokeObjectURL(url));
}

function loadFromDataUrl(file: File): Promise<HTMLImageElement> {
  return fileToDataUrl(file).then(loadImage);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => {
      file.arrayBuffer()
        .then((buffer) => resolve(`data:${file.type || mimeFromName(file.name)};base64,${arrayBufferToBase64(buffer)}`))
        .catch(reject);
    };
    r.readAsDataURL(file);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

function mimeFromName(name = ""): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Note: do NOT set crossOrigin — on some Android WebViews it taints
    // blob:/data: URLs and causes onerror to fire spuriously.
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}
