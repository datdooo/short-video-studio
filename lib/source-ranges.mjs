// Source seconds, numeric and exact. No coercion, tail tolerance or snapping.
export const MAX_SOURCE_RANGES = 500;
export function validSourceRange(range, duration = Infinity) {
  return !!range && Number.isFinite(range.start) && Number.isFinite(range.end)
    && range.start >= 0 && range.end > range.start && range.end <= duration;
}
