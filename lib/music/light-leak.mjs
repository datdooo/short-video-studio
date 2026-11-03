import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYBACK_RATE, RENDER_FPS } from "../render-config.mjs";
// Original procedural screen wash. Shared constants drive Canvas and FFmpeg.
// RGB bloom lobes overlap broadly; a soft neutral peak masks the join, no flash.
export const LEAK_BLOOMS = Object.freeze([
  { x: 0.1, y: 0.25, drift: 0.5, phase: 0, color: [1, 0.12, 0.4] },
  { x: 0.8, y: 0.7, drift: -0.45, phase: 1.7, color: [0.12, 0.8, 1] },
  { x: 0.45, y: 0.5, drift: 0.25, phase: 3.1, color: [0.9, 0.75, 0.15] },
]);
export function rainbowPixel(x, y, phase) {
  if (phase < 0 || phase > 1) return [0, 0, 0];
  const opacity = Math.sin(Math.PI * phase) ** 2;
  return [0, 1, 2].map((c) =>
    Math.round(
      255 *
        Math.min(
          0.96,
          opacity *
            (0.24 +
              0.52 *
                LEAK_BLOOMS.reduce(
                  (n, b) =>
                    n +
                    b.color[c] *
                      Math.exp(
                        -(
                          (x - (b.x + b.drift * (phase - 0.5))) ** 2 / 0.32 +
                          (y - (b.y + 0.12 * Math.sin(phase * Math.PI + b.phase))) ** 2 / 0.65
                        ),
                      ),
                  0,
                )),
        ),
    ),
  );
}
export function rainbowChannels(windows) {
  return [0, 1, 2].map((c) =>
    windows.reduceRight((rest, w) => {
      const p = `((T*${RENDER_FPS}/${PLAYBACK_RATE}-${w.startFrame})/${w.halfFrames * 2})`,
        o = `pow(sin(PI*${p}),2)`,
        lobes = LEAK_BLOOMS.map(
          (b) =>
            `${b.color[c]}*exp(-(pow(X/W-(${b.x}+${b.drift}*(${p}-.5)),2)/.32+pow(Y/H-(${b.y}+.12*sin(${p}*PI+${b.phase})),2)/.65))`,
        ).join("+");
      return `if(between(T,${(w.startFrame / RENDER_FPS) * PLAYBACK_RATE},${(w.endFrame / RENDER_FPS) * PLAYBACK_RATE}),255*min(.96,${o}*(.24+.52*(${lobes}))),${rest})`;
    }, "0"),
  );
}
export function rainbowSceneFilters(input, output, windows, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) {
  const active = windows.filter((w) => w.presetId === "rainbow-light-leak");
  if (!active.length) return [`[${input}]null[${output}]`];
  const [r, g, b] = rainbowChannels(active);
  return [
    `[${input}]format=gbrp,split=2[leakBase][leakSeed]`,
    `[leakSeed]scale=180:320,geq=r='${r}':g='${g}':b='${b}',scale=${width}:${height}:flags=bilinear,format=gbrp[leakWash]`,
    `[leakBase][leakWash]blend=all_mode=screen,format=rgb24[${output}]`,
  ];
}
