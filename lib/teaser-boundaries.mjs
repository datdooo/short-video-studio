// Caption timing can reject a cut through known speech, but cannot establish
// semantic appeal or action coherence. Coarse captions (>10s) aren't word timing.
export function checkHookSpeechBoundaries(value, cues = []) {
  const spoken = cues.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c.end-c.start <= 10 && String(c.text || '').trim());
  for (const time of [value.start,value.end]) {
    if (spoken.some(c => time > c.start + 0.35 && time < c.end - 0.35)) throw new Error('HOOK_SPLITS_TIMED_SPEECH: choose a complete caption boundary');
  }
  return value;
}
