/** Compress an image file to a data URL suitable for Site Data storage */

export async function fileToDataUrl(
  file: File,
  opts: { maxWidth?: number; maxBytes?: number } = {}
): Promise<string> {
  const maxWidth = opts.maxWidth ?? 720;
  const maxBytes = opts.maxBytes ?? 9000;

  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;
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

  let quality = 0.7;
  let dataUrl = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxBytes * 1.37) break;
    if (quality > 0.4) quality -= 0.08;
    else {
      w = Math.round(w * 0.8);
      h = Math.round(h * 0.8);
    }
  }
  bitmap.close();

  if (dataUrl.length > 14000) {
    throw new Error("Image still too large after compression. Try a smaller photo.");
  }
  return dataUrl;
}
