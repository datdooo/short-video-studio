// Compatibility only: saved optional transforms cannot be reactivated.
export function originalCutPlan(value, sourceId) {
  if (!value || typeof value !== 'object') return value;
  const plan = structuredClone(value);
  if (plan.transformLiteApplied && plan.transformLiteApplied.sourceId !== sourceId) throw new Error('Bản cắt cũ thuộc source khác.');
  if (plan.transformLiteOriginal) {
    plan.parts = plan.transformLiteOriginal.parts;
    plan.captionCues = plan.transformLiteOriginal.captionCues;
  }
  for (const key of ['transformLite', 'transformLiteOriginal', 'transformLiteApplied', 'transformLiteWarning']) delete plan[key];
  if (Array.isArray(plan.parts)) for (const part of plan.parts) {
    if (!Array.isArray(part.segments)) continue;
    part.segments = part.segments.filter((segment) => !['summary_card', 'freeze'].includes(segment.type)).map((segment) => {
      const result = { ...segment }; delete result.focus; return result;
    });
  }
  return plan;
}
