export function lockedParts(plan) { return plan?.parts?.map(p => Boolean(p.manualLocked || plan.providerUsed === 'manual' && p.manualLocked !== false)) || [false,false]; }
export function assertMainLocks(plan,current) {
  lockedParts(current).forEach((locked,i)=>{if(locked && JSON.stringify(plan.parts[i]?.segments)!==JSON.stringify(current.parts[i].segments))throw new Error(`Part ${i+1} is manually locked; unlock it before changing its ranges.`);});
}
export function restoreLockedParts(plan,current) {
  assertMainLocks(plan,current);
  return {...plan,parts:plan.parts.map((part,i)=>lockedParts(current)[i]?structuredClone(current.parts[i]):part)};
}
