'use client';

import {CopyButton} from './copy-button';

export function WebAiPromptCopy({prompt,disabled,onCopied,onError}:{prompt:string;disabled:boolean;onCopied:()=>void;onError:()=>void}){
 const bytes=new TextEncoder().encode(prompt).byteLength;
 function download(){
  const url=URL.createObjectURL(new Blob([prompt],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='shortcut-prompt.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="studio-web-prompt-copy min-w-0 space-y-2">
  <textarea readOnly aria-label="Toàn bộ prompt web thủ công" className="studio-textarea w-full min-w-0" rows={5} value={prompt} />
  <div className="flex flex-wrap items-center gap-2">
   <CopyButton text={prompt} label="Sao chép toàn bộ" disabled={disabled} className="border border-white/10" onCopied={onCopied} onError={onError} errorMessage="Cho phép Clipboard rồi thử lại."/>
   <button type="button" className="studio-ghost" disabled={disabled} onClick={download}>Tải .txt</button>
  </div>
  {prompt&&<p className="studio-muted text-xs">{(bytes/1024).toFixed(1)} KiB{bytes>100000?' · Prompt lớn; nơi nhận có thể giới hạn dung lượng.':''}</p>}
 </div>;
}
