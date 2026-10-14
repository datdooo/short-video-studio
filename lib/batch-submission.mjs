// Preserve any new text entered while the submission request was in flight.
// A failed submission must never call this helper.
export function clearSubmittedBatchInput(current, submitted) {
  if (current === submitted) return "";
  if (submitted && current.startsWith(submitted)) {
    const remainder = current.slice(submitted.length);
    // A changed URL can share the old prefix: do not delete part of that URL.
    if (/\s$/.test(submitted) || /^\s/.test(remainder)) return remainder.trimStart();
  }
  return current;
}
