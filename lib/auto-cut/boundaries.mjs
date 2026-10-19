// Reuse the editor's cue-boundary semantics without inventing word timestamps.
export function sentenceBoundaries(cues = []) {
  const end = c => /[.!?。！？]["”’']?\s*$/u.test(c.text);
  return {
    ends: cues.filter(end).map(c => c.end),
    starts: cues.filter((c, i) => i === 0 || end(cues[i - 1]) || c.start - cues[i - 1].end >= .2).map(c => c.start),
  };
}
