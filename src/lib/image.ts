/** Reads a Blob as a data: URL (for previews that need no cleanup). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Center-crops an image to a square and re-encodes it as JPEG, at most `size` px.
 * Keeps uploads small (phone photos are often several MB). Browser only.
 */
export async function toSquareJpeg(file: Blob, size = 512, quality = 0.88): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("This image format isn't supported. Please use JPG, PNG, or WebP.");
    }

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("The image appears to be empty.");
    const out = Math.min(size, side);

    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process this image.");

    ctx.fillStyle = "#ffffff"; // transparent PNGs would otherwise turn black
    ctx.fillRect(0, 0, out, out);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      out,
      out,
    );

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image."))),
        "image/jpeg",
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
