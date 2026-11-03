// Only identical, durable job plans may replace a duplicate batch-item plan.
export function encodeHistory(batches, jobs, { maxHistoryJobs = 0, confirmed = false } = {}) {
  const referenced = new Set(batches.flatMap(batch => batch.items.flatMap(item => [item.jobId, item.submissionId]).filter(Boolean)));
  let retained = jobs;
  if (confirmed && Number.isSafeInteger(maxHistoryJobs) && maxHistoryJobs > 0) {
    const candidates = jobs.filter(job => !referenced.has(job.id) && ['done', 'error', 'cancelled'].includes(job.state));
    const keep = new Set(candidates.slice(-maxHistoryJobs).map(job => job.id));
    retained = jobs.filter(job => !candidates.includes(job) || keep.has(job.id));
  }
  const byId = new Map(retained.map(job => [job.id, job]));
  const compact = batches.map(batch => ({ ...batch, items: batch.items.map(item => {
    const id = item.jobId || item.submissionId;
    const plan = byId.get(id)?.plan;
    if (!item.plan || !plan || JSON.stringify(item.plan) !== JSON.stringify(plan)) return item;
    const { plan: duplicate, ...rest } = item;
    void duplicate;
    return { ...rest, planJobId: id };
  }) }));
  return { batches: compact, jobs: retained };
}
export function decodeHistory(history) {
  const jobs = new Map((history.jobs || []).map(job => [job.id, job]));
  for (const batch of history.batches || []) for (const item of batch.items || []) {
    if (!item.planJobId) continue;
    const job = jobs.get(item.planJobId);
    if (!job?.plan) throw Error('Missing referenced history plan; history was not replaced.');
    item.plan = structuredClone(job.plan);
    delete item.planJobId;
  }
  return history;
}
