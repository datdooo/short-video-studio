'use client';

import {useMemo,useState} from 'react';
import {splitWebAiPrompt} from '@/lib/muse-plan.mjs';
import {CopyButton} from './copy-button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './ui/select';

export function WebAiPromptCopy({prompt,disabled,onCopied,onError}:{prompt:string;disabled:boolean;onCopied:()=>void;onError:()=>void}){
 const blocks=useMemo(()=>splitWebAiPrompt(prompt),[prompt]);
 const [selection,setSelection]=useState({prompt:'',index:0});
 const index=selection.prompt===prompt?Math.min(selection.index,blocks.length-1):0;
 return <div className="studio-web-prompt-copy">
  <CopyButton text={blocks[index]||''} label={blocks.length>1?`Copy ${index+1}/${blocks.length}`:'Copy prompt'} disabled={disabled} className="w-full border border-white/10" onCopied={onCopied} onError={onError} errorMessage="Cho phép Clipboard rồi thử lại."/>
  {blocks.length>1&&<>
   <Select value={String(index)} onValueChange={value=>setSelection({prompt,index:Number(value)})}>
    <SelectTrigger aria-label="Khối text prompt cần copy" className="w-full"><SelectValue/></SelectTrigger>
    <SelectContent position="popper" align="start">{blocks.map((_,i)=><SelectItem key={i} value={String(i)}>Khối {i+1}/{blocks.length}</SelectItem>)}</SelectContent>
   </Select>
   <p className="studio-muted text-xs">Gửi đủ {blocks.length} khối theo thứ tự trong cùng cuộc trò chuyện, rồi lấy JSON.</p>
  </>}
 </div>;
}
