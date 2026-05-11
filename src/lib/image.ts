// Robust image downscale that works reliably on Android WebView / Capacitor.
// First we try createObjectURL + img.decode(); if anything fails (some Android
// WebView builds reject blob: URLs on first selection) we fall back to
// FileReader → data URL.

export async function downscaleImage(file: File, maxSize: number): Promise<string> {
  let img: HTMLImageElement;
  try {
    img = await loadFromBlob(file);
  } catch {
    img = await loadFromDataUrl(file);
  }
  return drawScaled(img, maxSize);
}

function drawScaled(img: HTMLImageElement, maxSize: number): string {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
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
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => loadImage(String(r.result)).then(resolve, reject);
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Note: do NOT set crossOrigin — on some Android WebViews it taints
    // blob:/data: URLs and causes onerror to fire spuriously.
    img.onload = () => {
      const done = () => resolve(img);
      const dec = (img as any).decode?.();
      if (dec && typeof dec.then === "function") dec.then(done).catch(done);
      else done();
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}
