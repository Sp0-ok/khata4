// Robust image downscale that works reliably on Android WebView / Capacitor.
// FileReader.readAsDataURL was failing on the first selection on some devices,
// so we use createObjectURL + img.decode() which is more reliable.

export async function downscaleImage(file: File, maxSize: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, maxSize / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // decode() ensures pixels are ready before draw on slow first-load.
      const done = () => resolve(img);
      if ((img as any).decode) (img as any).decode().then(done).catch(done);
      else done();
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}
