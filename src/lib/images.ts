/** Compress an image file to a data URL suitable for Site Data storage */

export async function fileToDataUrl(
  file: File,
  opts: { maxWidth?: number; maxBytes?: number; square?: boolean } = {}
): Promise<string> {
  const maxWidth = opts.maxWidth ?? 720;
  const maxBytes = opts.maxBytes ?? 9000;
  const square = opts.square ?? false;

  const bitmap = await createImageBitmap(file);
  let srcW = bitmap.width;
  let srcH = bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  // Center-crop to square for profile photos
  if (square) {
    const side = Math.min(srcW, srcH);
    sx = Math.floor((srcW - side) / 2);
    sy = Math.floor((srcH - side) / 2);
    sw = side;
    sh = side;
    srcW = side;
    srcH = side;
  }

  let w = srcW;
  let h = srcH;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas not supported");
  }

  let quality = 0.72;
  let dataUrl = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxBytes * 1.37) break;
    if (quality > 0.4) quality -= 0.08;
    else {
      w = Math.max(48, Math.round(w * 0.8));
      h = Math.max(48, Math.round(h * 0.8));
    }
  }
  bitmap.close();

  if (dataUrl.length > 14000) {
    throw new Error("Image still too large after compression. Try a smaller photo.");
  }
  return dataUrl;
}

/** Smaller square avatar for member profiles (fits Site Data 16KB records) */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  return fileToDataUrl(file, { maxWidth: 240, maxBytes: 4500, square: true });
}
