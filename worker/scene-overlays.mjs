import path from "node:path";
import sharp from "sharp";
import { activeSceneOverlays, getOverlayAsset } from "../lib/visual-style/overlays.mjs";

// Flatten static scene layers once per job. Serialized state never supplies a path.
export async function renderSceneOverlay({ overlays, publicRoot, outputPath }) {
  const active = activeSceneOverlays(overlays);
  if (!active.length) return null;
  const inputs = [];
  for (const overlay of active) {
    const asset = getOverlayAsset(overlay.assetId);
    const { data, info } = await sharp(path.join(publicRoot, "overlays", asset.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== asset.width || info.height !== asset.height || info.channels !== 4) throw new Error("Invalid trusted overlay asset dimensions.");
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * overlay.opacity);
    inputs.push({ input: await sharp(data, { raw: info }).png().toBuffer() });
  }
  await sharp({ create: { width: 1080, height: 1920, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(inputs).png().toFile(outputPath);
  return outputPath;
}
