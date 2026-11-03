/** Compact list responses keep only the plan metadata consumed by the render UI. */
export function compactRenderSnapshot(snapshot) {
  const { plan, ...compact } = snapshot;
  return { ...compact, planSummary: plan && {
    originalTitle: plan.originalTitle,
    parts: plan.parts.map(({ id, title, hashtags }) => ({ id, title, hashtags })),
  } };
}
export function retainEqualJobs(current, next) {
  return JSON.stringify(current) === JSON.stringify(next) ? current : next;
}
