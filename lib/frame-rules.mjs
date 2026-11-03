// Instruction variants for requests that attach uniformly sampled frames (Codex lane).
// The canonical text-only rules stay untouched; every substitution must match or fail loudly.
export const FRAME_COVERAGE_VERSION = "coverage-frames-v1";

const MAIN_SWAPS = [
  [
    "No images/video/audio are supplied; never claim to see/hear footage.",
    "Attached images are uniformly sampled stills listed in visualCoverage (image index to source second). They are NOT continuous video and no audio is supplied: never claim to see or hear anything between stills; use them only to check visible context at their timestamps. Cut timing stays grounded in transcript cues and the other supplied evidence.",
  ],
  [
    "If text/numeric evidence cannot justify excluding a related quiet continuation, keep it and disclose uncertainty; never invent visual action.",
    "If the supplied text AND the sampled stills cannot justify excluding a related quiet continuation, keep it and disclose uncertainty; never invent visual action.",
  ],
];
const TEXT_ONLY_SENTENCE = "TEXT ONLY: no images/video/audio/files are supplied; never claim visual observation or fetch URLs.";
const TEXT_AND_STILLS_SENTENCE =
  "TEXT PLUS SAMPLED STILLS: the attached images are listed in visualCoverage; no continuous video, audio or files are supplied; never claim visual observation beyond those stills or fetch URLs.";

function swap(text, pairs) {
  return pairs.reduce((rules, [before, after]) => {
    if (!rules.includes(before)) throw Error("Frame prompt rule missing: regenerate or repair the canonical instructions.");
    return rules.replace(before, after);
  }, text);
}
export const framedMainRules = (text) => swap(text, MAIN_SWAPS);
export const framedTextInstructions = (text) => swap(text, [[TEXT_ONLY_SENTENCE, TEXT_AND_STILLS_SENTENCE]]);

const clock = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
/** Text block appended after the evidence JSON: image N (1-based, attachment order) is source time T. */
export function coverageManifestText(manifest) {
  const rows = manifest.times.map((time, index) => `Image ${index + 1} = source second ${time.toFixed(1)} (${clock(time)})`);
  return [
    `VISUAL COVERAGE (${FRAME_COVERAGE_VERSION}): ${manifest.count} stills sampled evenly across the whole source, about one every ${manifest.intervalSeconds.toFixed(0)} seconds.`,
    "The images are attached in this order. They are sparse stills, not continuous video, and carry no audio.",
    ...rows,
  ].join("\n");
}
