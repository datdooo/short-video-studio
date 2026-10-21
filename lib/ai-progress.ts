export type AiRequestMetric={model:string;requestedServiceTier?:string;actualServiceTier?:string|null;responseModel?:string;requestedReasoning:string|null;actualReasoning:string|null;status:string;phase?:string;inputCharacters?:number;rawInputCharacters?:number;inputFormat?:string;imageCount?:number;partCount?:number;providerMs?:number;readMs?:number;usage?:Record<string,number>};
export type AiDiagnostics={id:string;kind:string;stage:string;elapsedMs:number;requestCount:number;requests:AiRequestMetric[];events:{stage:string;elapsedMs:number;durationMs?:number;reason?:string;partId?:number}[]};
const text=(value:unknown,max=120)=>typeof value==='string'?value.slice(0,max):'';
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:undefined;
// Only operational statistics enter the UI. No prompt/response/source payload.
export function aiDiagnostics(value:unknown):AiDiagnostics|null{
 if(!value||typeof value!=='object')return null;
 const data=value as Record<string,unknown>;
 if(typeof data.id!=='string'||typeof data.stage!=='string')return null;
 return{id:text(data.id),kind:text(data.kind),stage:text(data.stage),elapsedMs:number(data.elapsedMs)||0,requestCount:number(data.requestCount)||0,
  requests:(Array.isArray(data.requests)?data.requests:[]).slice(0,40).filter(v=>v&&typeof v==='object').map(raw=>{
   const item=raw as Record<string,unknown>,usage:Record<string,number>={};
   if(item.usage&&typeof item.usage==='object')for(const [key,value]of Object.entries(item.usage))if(number(value)!==undefined&&/^[a-z_]{1,48}$/.test(key))usage[key]=value as number;
   return{model:text(item.model),requestedServiceTier:text(item.requestedServiceTier)||undefined,actualServiceTier:text(item.actualServiceTier)||null,...(text(item.inputFormat)?{inputFormat:text(item.inputFormat)}:{}),...(number(item.rawInputCharacters)!==undefined?{rawInputCharacters:number(item.rawInputCharacters)}:{}),...(text(item.phase)?{phase:text(item.phase)}:{}),...(number(item.inputCharacters)!==undefined?{inputCharacters:number(item.inputCharacters)}:{}),...(number(item.imageCount)!==undefined?{imageCount:number(item.imageCount)}:{}),...(number(item.partCount)!==undefined?{partCount:number(item.partCount)}:{}),...(text(item.responseModel)?{responseModel:text(item.responseModel)}:{}),requestedReasoning:text(item.requestedReasoning)||null,actualReasoning:text(item.actualReasoning)||null,status:text(item.status),...(number(item.providerMs)!==undefined?{providerMs:number(item.providerMs)}:{}),...(number(item.readMs)!==undefined?{readMs:number(item.readMs)}:{}),...(Object.keys(usage).length?{usage}:{})};
  }),events:(Array.isArray(data.events)?data.events:[]).slice(-160).filter(v=>v&&typeof v==='object').map(raw=>{const item=raw as Record<string,unknown>;return{stage:text(item.stage),elapsedMs:number(item.elapsedMs)||0,...(number(item.durationMs)!==undefined?{durationMs:number(item.durationMs)}:{}),...(typeof item.reason==='string'?{reason:text(item.reason,240)}:{}),...(number(item.partId)!==undefined?{partId:number(item.partId)}:{})};})};
}
export async function readAiOperation<T extends object>(response:Response,onProgress:(diagnostics:AiDiagnostics)=>void):Promise<T&{error?:string;diagnostics?:AiDiagnostics}>{
 if(!response.headers.get('content-type')?.includes('application/x-ndjson')){
  const data=await response.json();const diagnostics=aiDiagnostics(data.diagnostics);if(diagnostics)onProgress(diagnostics);return data;
 }
 const reader=response.body?.getReader();if(!reader)throw Error('Không đọc được tiến độ phân tích.');
 const decoder=new TextDecoder();let pending='',result:(T&{error?:string;diagnostics?:AiDiagnostics})|undefined;
 const consume=(line:string)=>{if(!line.trim())return;const data=JSON.parse(line);const diagnostics=aiDiagnostics(data.diagnostics);if(diagnostics)onProgress(diagnostics);if(data.type==='result'||data.type==='error')result=data;};
 try{while(true){const {done,value}=await reader.read();pending+=decoder.decode(value||new Uint8Array(),{stream:!done});if(pending.length>8*1024*1024)throw Error('Kết quả phân tích vượt giới hạn đọc.');const lines=pending.split('\n');pending=lines.pop()||'';for(const line of lines)consume(line);if(done)break;}if(pending.trim())consume(pending);}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(!result)throw Error('Kết nối phân tích kết thúc trước khi có kết quả.');return result;
}
