'use client';
import {useCallback} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import type {Controls,EditorSession} from '@/lib/editor-session';

export type ManualCutDraft={
 manualPart1Title:string;manualPart2Title:string;
 manualPart1Ranges:string;manualPart2Ranges:string;
};
const EMPTY_MANUAL_CUT:ManualCutDraft={manualPart1Title:'',manualPart2Title:'',manualPart1Ranges:'',manualPart2Ranges:''};
export function manualCutScope(sourceMode:EditorSession['sourceMode'],sourceUrl:string,localFileName:string,batchEditing?:EditorSession['batchEditing'],localDraftId=''):string{
 // Preparing an unmanaged source must not change its editing identity. Batch
 // items sharing a URL still own independent raw manual ranges and titles.
 return JSON.stringify([sourceMode,sourceMode==='youtube'?sourceUrl:localDraftId||localFileName,batchEditing?.batchId||'',batchEditing?.itemId||'']);
}
export function manualCutDraftKey(scope:string):string{return`${scope}:manual-cut`;}
export function isManualCutDraft(value:unknown):value is ManualCutDraft{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const raw=value as Record<string,unknown>;
 return Object.keys(EMPTY_MANUAL_CUT).every(field=>typeof raw[field]==='string');
}
function useManualField(key:string,field:keyof ManualCutDraft,setControls:Dispatch<SetStateAction<Controls>>):Dispatch<SetStateAction<string>>{
 return useCallback(update=>setControls(current=>{
  const raw=current[key],previous=isManualCutDraft(raw)?raw:EMPTY_MANUAL_CUT;
  const next=typeof update==='function'?update(previous[field]):update;
  if(typeof next!=='string'||next===previous[field])return current;
  return{...current,[key]:{...previous,[field]:next}};
 }),[key,field,setControls]);
}
export function useManualCutDraft({controls,setControls,scope}:{controls:Controls;setControls:Dispatch<SetStateAction<Controls>>;scope:string}){
 const key=manualCutDraftKey(scope),raw=controls[key],values=isManualCutDraft(raw)?raw:EMPTY_MANUAL_CUT;
 const setManualPart1Title=useManualField(key,'manualPart1Title',setControls);
 const setManualPart2Title=useManualField(key,'manualPart2Title',setControls);
 const setManualPart1Ranges=useManualField(key,'manualPart1Ranges',setControls);
 const setManualPart2Ranges=useManualField(key,'manualPart2Ranges',setControls);
 return{...values,setManualPart1Title,setManualPart2Title,setManualPart1Ranges,setManualPart2Ranges};
}
