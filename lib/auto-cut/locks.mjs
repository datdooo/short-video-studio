export function lockedParts(plan) { return plan?.parts?.map(p => Boolean(p.mainEdited || p.manualLocked || plan.providerUsed === 'manual' && p.manualLocked !== false)) || [false,false]; }
export function assertMainLocks(plan,current) {
  lockedParts(current).forEach((locked,i)=>{if(locked && JSON.stringify(plan.parts[i]?.segments)!==JSON.stringify(current.parts[i].segments))throw new Error(`Part ${i+1}: kết quả AI đã đổi main bạn sửa tay; giữ nguyên mốc hiện tại của bạn.`);});
}
export function restoreLockedParts(plan,current) {
  // The web output schema carries cuts, not renderer-only per-segment fields.
  // Check every exact source cut/padding bit, then restore the entire protected
  // original, including its labels/focus and manual metadata.
  const cuts=part=>part?.segments?.map(s=>[s.start,s.end,s.isPadding===true]);
  lockedParts(current).forEach((locked,i)=>{if(locked&&JSON.stringify(cuts(plan.parts[i]))!==JSON.stringify(cuts(current.parts[i])))throw Error(`Part ${i+1}: kết quả AI đã đổi main bạn sửa tay; giữ nguyên mốc hiện tại của bạn.`);});
  const restored={...plan,parts:plan.parts.map((part,i)=>lockedParts(current)[i]?structuredClone(current.parts[i]):part)};
  assertMainLocks(restored,current);return restored;
}
