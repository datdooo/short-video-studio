// Original static assets. Fixed integer grain seed; all other pixels use fixed math.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { OVERLAY_ASSETS } from "../lib/visual-style/overlays.mjs";
export async function generateOverlayAssets(output = path.resolve(import.meta.dirname, "../public/overlays")) {
  await mkdir(output, { recursive: true });
  let seed = 0x51a71c06;
  const tile = Array.from({ length: 128 * 128 }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; });
  const manifest = {};
  for (const asset of Object.values(OVERLAY_ASSETS)) {
    const { width, height } = asset, data = Buffer.alloc(width * height * 4);
    const pixel = (x, y, rgb, alpha) => { const offset = (y * width + x) * 4; for (let c = 0; c < 3; c++) data[offset + c] = rgb[c]; data[offset + 3] = Math.max(0, Math.min(255, Math.round(alpha))); };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (asset.id === "overlay.grain.v1") { const n = tile[(y % 128) * 128 + x % 128]; pixel(x, y, n & 1 ? [255, 255, 255] : [0, 0, 0], 8 + (n >>> 1) % 72); }
      if (asset.id === "overlay.vignette.v1") { const r = Math.hypot((x + 0.5 - width / 2) / (width * 0.7), (y + 0.5 - height / 2) / (height * 0.7)); const t = Math.max(0, Math.min(1, (r - 0.35) / 0.65)); pixel(x, y, [0, 0, 0], 145 * t * t * (3 - 2 * t)); }
      if (asset.id === "overlay.soft-glow.v1") { const r = ((x / width - 0.52) / 0.28) ** 2 + ((y / height - 0.36) / 0.2) ** 2; pixel(x, y, [255, 224, 185], 70 * Math.exp(-r * 2)); }
      if (asset.id === "overlay.film-frame.v1") { const edge = Math.min(x, width - 1 - x, y, height - 1 - y); if (edge < 14) pixel(x, y, [14, 16, 20], 200); else if (edge >= 22 && edge < 25) pixel(x, y, [216, 211, 198], 130); }
    }
    if (asset.id === "overlay.rec-hud.v1") {
      const rect = (x, y, w, h, rgb = [240, 240, 240], a = 220) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) pixel(x + dx, y + dy, rgb, a); };
      for (const x of [48, 976]) for (const y of [48, 1816]) { rect(x, y === 48 ? y : y + 52, 56, 4); rect(x === 48 ? x : x + 52, y, 4, 56); }
      for (let y = 328; y < 344; y++) for (let x = 52; x < 68; x++) if ((x - 59.5) ** 2 + (y - 335.5) ** 2 <= 64) pixel(x, y, [235, 64, 64], 240);
      const letters = [ ["11110","10001","10001","11110","10100","10010","10001"], ["11111","10000","10000","11110","10000","10000","11111"], ["01111","10000","10000","10000","10000","10000","01111"] ];
      letters.forEach((rows, i) => rows.forEach((row, y) => [...row].forEach((bit, x) => { if (bit === "1") rect(84 + i * 26 + x * 4, 322 + y * 4, 4, 4); })));
    }
    const file = path.join(output, asset.file);
    await sharp(data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(file);
    const bytes = await readFile(file);
    manifest[asset.id] = { file: asset.file, width, height, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await generateOverlayAssets());
