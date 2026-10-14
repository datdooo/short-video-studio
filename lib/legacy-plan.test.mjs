import test from 'node:test';
import assert from 'node:assert/strict';
import { originalCutPlan } from './legacy-plan.mjs';
test('new cut plans are preserved without extra processing', () => {
  const plan = { parts: [{ segments: [{ start: 1, end: 40 }] }] };
  assert.deepEqual(originalCutPlan(plan, 'source'), plan);
});
test('saved transforms restore original cuts/captions and cannot reactivate', () => {
  const original = { parts: [{ segments: [{ start: 1, end: 40 }] }], captionCues: { cues: [{ text: 'Original speech' }] } };
  const saved = { transformLite: { enabled: true }, transformLiteApplied: { sourceId: 'source' }, transformLiteOriginal: original, parts: [{ segments: [{ start: 1, end: 10, focus: { scale: 1.08 } }, { start: 10, end: 10, type: 'summary_card', holdDuration: 1.875 }] }] };
  assert.deepEqual(originalCutPlan(saved, 'source'), original);
  assert.ok(saved.transformLite, 'History input is not mutated');
  assert.throws(() => originalCutPlan(saved, 'other'), /source khác/);
});
