import { TITLE_SHINE_WIDTH } from "../../lib/render-config.mjs";

/**
 * Soft-edged shine sweep: the cropped shine strip with its alpha multiplied by a triangular
 * ramp across the strip (0 at both edges, 1 in the middle). The previous `geq` evaluated four
 * interpreted expressions for every pixel of every frame (~25 ms/frame, single threaded) and
 * dominated export time. The ramp is constant, so it is built once (one `geq` evaluation on a
 * single frame, then looped) and applied with a plain multiply blend + alphamerge. Output differs
 * from the `geq` result by at most one 8-bit alpha level (SSIM 0.999999, PSNR ~82 dB measured).
 * Labels are unique per graph; `input` is the shine PNG input index.
 */
export function shineSweepFilters({ input, x, staticInputFilter = "", width = TITLE_SHINE_WIDTH }) {
  const half = width / 2;
  return [
    `[${input}:v]${staticInputFilter}format=rgba,crop=${width}:1920:x='${x}':y=0,split[shineColor][shineAlpha]`,
    "[shineAlpha]alphaextract[shineAlphaPlane]",
    `color=c=white:s=${width}x1920:r=30,format=gray,geq=lum='255*max(0,1-abs(X-${half})/${half})',trim=end_frame=1,loop=loop=-1:size=1:start=0,setpts=N/(30*TB)[shineRamp]`,
    "[shineAlphaPlane][shineRamp]blend=all_mode=multiply:shortest=1[shineMask]",
    "[shineColor][shineMask]alphamerge,format=rgba[shine]",
  ];
}

/**
 * A static or sequence overlay input that is converted to the overlay's native alpha format once
 * (before looping / fps duplication) instead of on every output frame. Bit-identical to the
 * per-frame conversion for the default YUV overlay path; RGB overlays keep their RGBA source.
 */
export function overlaySourceFilter({ input, label, rgb, loop = "", pre = "" }) {
  return rgb
    ? `[${input}:v]${pre}${loop}format=rgba[${label}]`
    : `[${input}:v]${pre}format=yuva420p,${loop ? loop.replace(/,$/, "") : "null"}[${label}]`;
}
