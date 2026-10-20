'use client';
import {createContext,useContext,useCallback,useEffect} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import type {Controls} from '@/lib/editor-session';
export const EditorDraftContext=createContext<{controls:Controls;setControls:Dispatch<SetStateAction<Controls>>;scope:string;activity:(key:string,busy:boolean)=>void}|null>(null);
// UI-only drafts are never merged into effective plan/ranges by persistence.
export function useEditorDraft<T>(name:string,initial:T,valid:(v:unknown)=>boolean):[T,Dispatch<SetStateAction<T>>]{
 const ctx=useContext(EditorDraftContext),key=`${ctx?.scope||''}:${name}`;
 const raw=ctx?.controls[key],value=raw!==undefined&&valid(raw)?raw as T:initial;
 const setControls=ctx?.setControls;
 const set=useCallback<Dispatch<SetStateAction<T>>>(update=>{setControls?.(current=>{const previous=current[key];const next=typeof update==='function'?(update as (v:T)=>T)(previous!==undefined&&valid(previous)?previous as T:initial):update;return{...current,[key]:next};});},[key,setControls,initial,valid]);
 return[value,set];
}
export function useDraftActivity(key:string,busy:boolean){const ctx=useContext(EditorDraftContext),report=ctx?.activity;useEffect(()=>{report?.(key,busy);return()=>report?.(key,false);},[key,busy,report]);}

// Object insertion order is not an identity: restored whitelisted records can
// have different key order while retaining identical values and exact times.
export function draftIdentity(value:unknown):string{
 return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
}
