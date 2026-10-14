import test from 'node:test';
import assert from 'node:assert/strict';
import { completedRenderJobs } from './render-delete.mjs';
test('delete-all selects finished jobs only, preserving active and still-stopping sources', () => {
  const jobs = [
    { id: 'done', sourceId: 'a', state: 'done' },
    { id: 'error', sourceId: 'b', state: 'error' },
    { id: 'cancelled', sourceId: 'c', state: 'cancelled' },
    { id: 'active', sourceId: 'd', state: 'rendering' },
    { id: 'old-shared', sourceId: 'd', state: 'done' },
    { id: 'queued', sourceId: 'e', state: 'queued' },
    { id: 'stopping', sourceId: 'f', state: 'cancelled', stopping: true },
  ];
  assert.deepEqual(completedRenderJobs(jobs).map((job) => job.id), ['done', 'error', 'cancelled']);
  assert.equal(jobs.length, 7); assert.deepEqual(completedRenderJobs([]), []);
});
