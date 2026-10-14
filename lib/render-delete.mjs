export function completedRenderJobs(jobs) {
  const activeSources = new Set(jobs.filter((job) => job.stopping || ['queued', 'rendering'].includes(job.state)).map((job) => job.sourceId));
  return jobs.filter((job) => ['done', 'error', 'cancelled'].includes(job.state) && !job.stopping && !activeSources.has(job.sourceId));
}
