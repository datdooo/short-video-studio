'use client';
import {useCallback,useReducer} from 'react';
import type {SetStateAction} from 'react';
import type {EditPlan,EditPart} from '@/lib/edit-plan';
// Cut history excludes media, captions, appearance, music and renderer output.
const keys=['segments','teaser','teaserEnabled','customTeaser','mainEdited','manualLocked','aiMainRanges','startTrimApplied','smartCutApplied','teaserNeedsReselection'] as const;
type CutPart=Pick<EditPart,'id'|typeof keys[number]>;
type Snapshot={parts:CutPart[];providerUsed:EditPlan['providerUsed'];analysis:EditPlan['analysis'];teaserPolicy:EditPlan['teaserPolicy'];teaserTranscriptKey:EditPlan['teaserTranscriptKey']};
type Entry={before:Snapshot;after:Snapshot;label:string;partIds:number[]};
type State={plan:EditPlan;past:Entry[];future:Entry[];group?:string};
type Action={type:'set'|'cut';update:SetStateAction<EditPlan>;label?:string;group?:string}|{type:'undo'}|{type:'redo'}|{type:'clear'}|{type:'boundary'};
const stable=(value:unknown)=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)??'';
const projection=(plan:EditPlan):Snapshot=>({parts:plan.parts.map(p=>Object.fromEntries(['id',...keys].map(key=>[key,p[key as keyof EditPart]])) as CutPart),providerUsed:plan.providerUsed,analysis:plan.analysis,teaserPolicy:plan.teaserPolicy,teaserTranscriptKey:plan.teaserTranscriptKey});
const snapshot=(plan:EditPlan):Snapshot=>structuredClone(projection(plan));
function install(plan:EditPlan,value:Snapshot):EditPlan{return{...plan,providerUsed:value.providerUsed,analysis:structuredClone(value.analysis),teaserPolicy:value.teaserPolicy,teaserTranscriptKey:value.teaserTranscriptKey,parts:plan.parts.map(p=>({...p,...structuredClone(value.parts.find(row=>row.id===p.id)!)}))};}
function reduce(state:State,action:Action):State{
 if(action.type==='clear')return{...state,past:[],future:[],group:undefined};
 if(action.type==='boundary')return{...state,group:undefined};
 if(action.type==='undo'||action.type==='redo'){
  const entry=(action.type==='undo'?state.past:state.future).at(-1);if(!entry)return state;
  const expected=action.type==='undo'?entry.after:entry.before;
  // A stale command never silently overwrites a newer Auto/import/source edit.
  if(stable(projection(state.plan))!==stable(expected))return{...state,past:[],future:[],group:undefined};
  return action.type==='undo'?{plan:install(state.plan,entry.before),past:state.past.slice(0,-1),future:[...state.future,entry],group:undefined}:{plan:install(state.plan,entry.after),past:[...state.past,entry],future:state.future.slice(0,-1),group:undefined};
 }
 const next=typeof action.update==='function'?action.update(state.plan):action.update;
 if(next===state.plan)return state;
 if(stable(projection(state.plan))===stable(projection(next)))return{...state,plan:next};
 if(action.type==='set')return{plan:next,past:[],future:[],group:undefined};
 const before=snapshot(state.plan),after=snapshot(next);
 const partIds=before.parts.filter((p,i)=>stable(p)!==stable(after.parts[i])).map(p=>p.id);
 const prior=state.past.at(-1),joined=Boolean(action.group&&action.group===state.group&&prior);
 let past=joined?[...state.past.slice(0,-1),{...prior!,after,partIds:[...new Set([...prior!.partIds,...partIds])]}]:[...state.past,{before,after,partIds,label:action.label||'Chỉnh cut'}];
 // Bound history by both count and serialized size; no decoder buffers stored.
 while(past.length&&(past.length>40||stable(past).length*2>4*1024*1024))past=past.slice(1);
 return{plan:next,past,future:[],group:action.group};
}
export function useCutHistory(initial:()=>EditPlan){
 const[state,dispatch]=useReducer(reduce,undefined,()=>({plan:initial(),past:[],future:[]} as State));
 const setPlan=useCallback((update:SetStateAction<EditPlan>)=>dispatch({type:'set',update}),[]);
 const setCutPlan=useCallback((update:SetStateAction<EditPlan>,label:string,group?:string)=>dispatch({type:'cut',update,label,group}),[]);
 const undo=useCallback(()=>dispatch({type:'undo'}),[]),redo=useCallback(()=>dispatch({type:'redo'}),[]),clear=useCallback(()=>dispatch({type:'clear'}),[]),boundary=useCallback(()=>dispatch({type:'boundary'}),[]);
 return{plan:state.plan,setPlan,setCutPlan,undo,redo,clear,boundary,previous:state.past.at(-1),next:state.future.at(-1)};
}
