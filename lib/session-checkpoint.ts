// Retain the last committed session reader through boundary unmount. No timer writes.
let checkpoint: (() => string) | undefined;
export function registerSessionCheckpoint(save: () => string) { checkpoint = save; }
export function attemptSessionCheckpoint() {
  try { return checkpoint?.() || ""; }
  catch { return "Chưa lưu được checkpoint phiên."; }
}
