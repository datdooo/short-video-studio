// Curated title-card entrances. No user supplied timing or expressions.
export const TITLE_ANIMATION_SECONDS = 0.5;
export const TITLE_SLIDE_PIXELS = 20;
export const TITLE_POP_START_SCALE = 0.975;
const definitions = Object.freeze([
  Object.freeze({ id: "none", label: "None", description: "Static titles (legacy appearance)" }),
  Object.freeze({ id: "fade-in", label: "Fade in", description: "Fade titles in over 0.5 seconds" }),
  Object.freeze({ id: "slide-up", label: "Slide up", description: "Fade and rise 20 pixels over 0.5 seconds" }),
  Object.freeze({ id: "pop-in", label: "Pop in", description: "Fade and grow from 97.5% over 0.5 seconds" }),
]);
export const TITLE_ANIMATION_IDS = Object.freeze(definitions.map(({ id }) => id));
export function normalizeTitleAnimation(id) {
  if (id === undefined) return "none";
  if (typeof id !== "string" || !TITLE_ANIMATION_IDS.includes(id)) throw new Error("Invalid title animation id.");
  return id;
}
export function getTitleAnimation(id) {
  const valid = normalizeTitleAnimation(id);
  return { ...definitions.find(({ id }) => id === valid) };
}
export function listTitleAnimations() { return TITLE_ANIMATION_IDS.map(getTitleAnimation); }
// Output/edited-part seconds, not source timestamps or wall-clock time.
export function titleAnimationAt(id, seconds) {
  id = normalizeTitleAnimation(id);
  const progress = Math.max(0, Math.min(1, (Number.isFinite(seconds) ? seconds : 0) / TITLE_ANIMATION_SECONDS));
  return {
    opacity: id === "none" ? 1 : progress,
    y: id === "slide-up" ? TITLE_SLIDE_PIXELS * (1 - progress) : 0,
    scale: id === "pop-in" ? TITLE_POP_START_SCALE + (1 - TITLE_POP_START_SCALE) * progress : 1,
  };
}
export function titleAnimationPreviewCss(id, seconds, canvasScale = 1) {
  const pose = titleAnimationAt(id, seconds);
  // No transform in the legacy path: preserve text rasterization and geometry.
  return normalizeTitleAnimation(id) === "none" ? {} : { opacity: pose.opacity, transform: `translateY(${pose.y * canvasScale}px) scale(${pose.scale})`, transformOrigin: "50% 50%" };
}
