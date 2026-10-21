export function completedRenderJobs(jobs) {
  return jobs.filter((job) => ['done', 'error', 'cancelled'].includes(job.state) && !job.stopping);
}
