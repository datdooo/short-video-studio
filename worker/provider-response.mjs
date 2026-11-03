import {safeUsage,aiEvent} from './ai-operation.mjs';
// Operational metadata only. Never retain remote message/body, headers, source,
// Authorization, cookies or arbitrary strings returned by a provider.
export const safeProviderId=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(value)?value:undefined;
// Fail closed on arbitrary prose: even an error can echo a prompt or credential.
// Retain bounded diagnostic vocabulary/known request fields, redact everything
// else rather than serializing a body or trusting quote-only secret removal.
const diagnosticWords=new Set(('unsupported supported invalid unknown unrecognized unexpected missing required forbidden not allowed available enabled disabled access denied permission insufficient quota exceeded limit rate request response parameter field value model reasoning effort service tier schema json format strict type input output tokens maximum max_output_tokens max_tool_calls service_tier gpt-6-luna none fast priority default background conversation metadata moderation multi_agent prompt prompt_cache_retention safety_identifier temperature top_logprobs top_p truncation user subscription sharing capability route authorization authentication scope token expired malformed error detail cannot must be is are was for this the a an on to with of and or use please no region country account workspace billing api text instructions store stream too large length context null false true boolean string integer array object additionalproperties properties required enum').split(' '));
export function safeProviderMessage(value){
 if(typeof value!=='string')return undefined;
 const clipped=value.slice(0,2048).replace(/Bearer\s+\S+|(?:sk-|eyJ)[a-zA-Z0-9_.-]+|https?:\/\/\S+|[\w.+-]+@[\w.-]+/gi,' [redacted] ');
 return clipped.replace(/[^a-zA-Z0-9_.:\s-]/g,' ').split(/\s+/).filter(Boolean).map(word=>diagnosticWords.has(word.toLowerCase().replace(/[.:]+$/,''))?word:'[redacted]').join(' ').replace(/(?:\[redacted\]\s*)+/g,'[redacted] ').trim().slice(0,320)||undefined;
}
const messages={PROVIDER_AUTH:'Codex chưa đăng nhập hoặc không có quyền; chạy codex login trong Terminal rồi thử lại.',PROVIDER_QUOTA:'ChatGPT báo hết quota; main và teaser cũ được giữ.',PROVIDER_RATE_LIMIT:'ChatGPT giới hạn lượt gọi; chờ rồi thử riêng bước lỗi.',MODEL_UNAVAILABLE:'Route ChatGPT từ chối model đã chọn; không tự đổi model.',REASONING_CONFIGURATION:'Route ChatGPT từ chối tham số reasoning đã gửi; không tự tăng mức.',FAST_MODE_UNSUPPORTED:'Route ChatGPT từ chối Faster đã gửi; không tự đổi chế độ.',PROVIDER_PAYLOAD:'ChatGPT từ chối kích thước hoặc định dạng đầu vào.',PROVIDER_PARAMETER:'ChatGPT từ chối tham số request; xem mã lỗi và trường trong chi tiết.',PROVIDER_HTTP:'HTTP ChatGPT không thành công; xem status trong chi tiết.',PROVIDER_JSON_ERROR:'ChatGPT trả JSON lỗi; xem mã lỗi trong chi tiết.',PROVIDER_STREAM_EMPTY:'ChatGPT trả stream rỗng, chưa có kết quả.',PROVIDER_STREAM_INTERRUPTED:'Stream ChatGPT bị ngắt trước khi đọc xong.',PROVIDER_STREAM_UNFINISHED:'Stream kết thúc nhưng chưa có response.completed.',PROVIDER_STREAM_PARSE:'Không phân tích được dữ liệu sự kiện SSE của ChatGPT.',PROVIDER_RESPONSE_TYPE:'ChatGPT trả kiểu response chưa được adapter hỗ trợ.',PROVIDER_RESPONSE_FAILED:'ChatGPT báo response.failed; xem mã lỗi trong chi tiết.',PROVIDER_REFUSAL:'ChatGPT trả refusal, không phải JSON kết quả.',PROVIDER_OUTPUT_MULTIPLE:'ChatGPT trả nhiều message kết quả; không ghép thành JSON.',PROVIDER_OUTPUT_EMPTY:'ChatGPT hoàn tất nhưng không có văn bản kết quả.',PROVIDER_OUTPUT_JSON_INVALID:'Đọc được văn bản nhưng JSON kết quả không hợp lệ.',INVALID_RESPONSE_INCOMPLETE:'ChatGPT trả kết quả chưa hoàn tất trong giới hạn output.',PROVIDER_NETWORK:'Không nhận được HTTP response; lỗi kết nối mạng/TLS.',PROVIDER_TIMEOUT:'Đã hết thời gian chờ ChatGPT.',PROVIDER_CONTENT_FILTER:'ChatGPT từ chối kết quả do bộ lọc nội dung.'};
export function providerError(code,meta={},cause){return Object.assign(new Error(`${code}: ${messages[code]||messages.PROVIDER_RESPONSE_FAILED}`),{code,...(meta.httpStatus?{status:meta.httpStatus}:{}),...(cause?{cause}:{} )});}
function remoteFailure(raw,meta,fallback){
 const shape=raw&&typeof raw==='object'?raw:{};
 const e=shape.error&&typeof shape.error==='object'?shape.error:shape;
 meta.errorShape=typeof shape.error==='string'?'error-string':shape.error&&typeof shape.error==='object'?'error-object':typeof shape.detail==='string'?'detail-string':'top-level';
 meta.providerMessage=safeProviderMessage(e.message||shape.detail||(typeof shape.error==='string'?shape.error:undefined));
 meta.providerCode=safeProviderId(e.code);meta.providerType=safeProviderId(e.type);meta.errorParam=safeProviderId(e.param);
 const hint=[e.code,e.type,e.param].filter(v=>typeof v==='string').join(' ');
 meta.classificationBasis=e.code?'provider-code':e.param?'provider-param':'http-status';
 let code=/subscription_sharing_usage_limit_exceeded|insufficient_quota|quota_exceeded|billing_hard_limit/i.test(hint)?'PROVIDER_QUOTA'
 :meta.httpStatus===401||meta.httpStatus===403?'PROVIDER_AUTH'
 :/reasoning|effort/i.test(hint)&&[200,400,422].includes(meta.httpStatus)?'REASONING_CONFIGURATION'
 :/service_tier/i.test(hint)&&[200,400,422].includes(meta.httpStatus)?'FAST_MODE_UNSUPPORTED'
 :/model_not_found|model_not_available|unsupported_model/i.test(hint)?'MODEL_UNAVAILABLE'
 :meta.httpStatus===429||/rate_limit/i.test(hint)?'PROVIDER_RATE_LIMIT'
 :meta.httpStatus===413||/context_length|payload_too_large|too many tokens/i.test(hint)?'PROVIDER_PAYLOAD'
 :[400,422].includes(meta.httpStatus)&&(e.param||/invalid_parameter|unsupported_parameter|subscription_sharing_unsupported_capability/i.test(hint))?'PROVIDER_PARAMETER':fallback;
 // Explicit SSE/JSON error codes also classify failures under HTTP 200.
 if(/invalid_api_key|authentication_error|token_expired/i.test(hint))code='PROVIDER_AUTH';
 return providerError(code,meta);
}
// Log only structural vocabulary. Unknown keys/types are counted, never copied.
const structuralKeys=new Set('id object type status error detail message code param response output output_text content text delta output_index content_index sequence_number item_id item usage model reasoning service_tier incomplete_details created_at role annotations logprobs'.split(' '));
const eventNames=new Set('error response.created response.queued response.in_progress response.completed response.failed response.incomplete response.output_item.added response.output_item.done response.content_part.added response.content_part.done response.output_text.delta response.output_text.done response.output_text.annotation.added response.refusal.delta response.refusal.done response.reasoning_summary_part.added response.reasoning_summary_part.done response.reasoning_summary_text.delta response.reasoning_summary_text.done response.reasoning_text.delta response.reasoning_text.done'.split(' '));
const itemNames=new Set(['message','reasoning','output_text','refusal','function_call','function_call_output','web_search_call','file_search_call','computer_call','image_generation_call','code_interpreter_call','mcp_call','mcp_list_tools','mcp_approval_request']);
export function providerHeaders(response){
 const header=response.headers.get('content-type'),value=String(header||'').trim();
 const mime=(value.match(/^([a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+)(?:\s*;|$)/)||[])[1]?.toLowerCase()||'unknown';
 // Preserve normal MIME/charset spelling, redact nonstandard parameter values.
 const safeHeader=value.split(';').slice(0,8).map((part,index)=>index===0?(mime==='unknown'?'[invalid]':part.trim().slice(0,120)):/^\s*charset\s*=\s*["']?[a-zA-Z0-9_-]{1,40}["']?\s*$/i.test(part)?part.trim():'[parameter-redacted]').join('; ').slice(0,400);
 const encoding=response.headers.get('content-encoding');
 return {contentType:mime,contentTypeHeader:header===null?'[missing]':safeHeader||'[empty]',contentEncoding:encoding===null?'[missing]':encoding.split(',').map(v=>['gzip','br','deflate','identity','zstd'].includes(v.trim().toLowerCase())?v.trim().toLowerCase():'[other]').slice(0,8).join(',')};
}
export async function readProviderOutput(response,meta,signal){
 Object.assign(meta,providerHeaders(response));
 const reader=response.body?.getReader(),decoder=new TextDecoder();
 let pending='',lineBuffer='',frameLines=[],bytes=0,events=0,completed=false,outputText='',actualReasoning=null,actualServiceTier=null,usage,responseModel,mode;
 const sequences=new Map();
 const parts=new Map(),seenEvents=new Set(),seenKeys=new Set(),seenItems=new Set();
 let unknownKeys=0,unknownEvents=0,unknownItems=0;
 const structure=value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  for(const key of Object.keys(value)){if(structuralKeys.has(key))seenKeys.add(key);else unknownKeys++;}
  if(Array.isArray(value.output)){
   meta.outputItemCount=value.output.length;
   for(const item of value.output){if(itemNames.has(item?.type))seenItems.add(item.type);else unknownItems++;}
  }
 };
 const metadata=value=>{if(!value||typeof value!=='object')return;structure(value);meta.responseId=safeProviderId(value.id)||meta.responseId;usage=safeUsage(value.usage)||usage;responseModel=safeProviderId(value.model)||responseModel;if(typeof value.reasoning?.effort==='string')actualReasoning=safeProviderId(value.reasoning.effort)||null;if(typeof value.service_tier==='string')actualServiceTier=safeProviderId(value.service_tier)||null;};
 const responseText=value=>{
  const messages=Array.isArray(value?.output)?value.output.filter(i=>i?.type==='message'&&Array.isArray(i.content)):[];
  if(messages.some(i=>i.content.some(c=>c?.type==='refusal')))throw providerError('PROVIDER_REFUSAL',meta);
  const texts=messages.flatMap(i=>i.content).filter(c=>c?.type==='output_text'&&typeof c.text==='string');
  if(texts.length>1)throw providerError('PROVIDER_OUTPUT_MULTIPLE',meta);
  return texts[0]?.text||'';
 };
 const envelope=value=>value&&typeof value==='object'&&!Array.isArray(value)&&value.object==='response'&&typeof value.id==='string'&&value.id.startsWith('resp_')&&typeof value.status==='string'&&Array.isArray(value.output);
 const failed=value=>{metadata(value);if(value?.status==='failed'||value?.error)throw remoteFailure(value,meta,'PROVIDER_RESPONSE_FAILED');if(value?.status==='incomplete')throw providerError(value.incomplete_details?.reason==='content_filter'?'PROVIDER_CONTENT_FILTER':'INVALID_RESPONSE_INCOMPLETE',meta);};
 const partKey=v=>`${Number.isInteger(v.output_index)?v.output_index:0}:${Number.isInteger(v.content_index)?v.content_index:0}`;
 const accept=lines=>{
  const dataLines=[];let namedType;
  for(const line of lines){if(line.startsWith(':'))continue;const colon=line.indexOf(':');const field=colon<0?line:line.slice(0,colon);let value=colon<0?'':line.slice(colon+1);if(value.startsWith(' '))value=value.slice(1);if(field==='data')dataLines.push(value);if(field==='event')namedType=value;}
  if(!dataLines.length)return;const data=dataLines.join('\n');if(data==='[DONE]')return;
  let v;try{v=JSON.parse(data);}catch{throw providerError('PROVIDER_STREAM_PARSE',meta);}
  if(!v||typeof v!=='object'||Array.isArray(v))throw providerError('PROVIDER_STREAM_PARSE',meta);
  if(Number.isInteger(v.sequence_number)){
   const previous=sequences.get(v.sequence_number);
   if(previous!==undefined){if(previous===data)return;throw providerError('PROVIDER_STREAM_PARSE',meta);}
   if(sequences.size>=20000)throw providerError('PROVIDER_PAYLOAD',meta);
   sequences.set(v.sequence_number,data);
  }
  structure(v);const type=v.type||namedType;
  if(!eventNames.has(type)){
   unknownEvents++;
   if(typeof type!=='string'||!/^response\.[a-z_]+(?:\.[a-z_]+){0,5}$/.test(type)||type.length>120||!Number.isInteger(v.sequence_number))throw providerError('PROVIDER_STREAM_PARSE',meta);
  }
  if(v.type&&namedType&&v.type!==namedType)throw providerError('PROVIDER_STREAM_PARSE',meta);
  const diagnosticType=eventNames.has(type)?type:'other-response-event';
  seenEvents.add(diagnosticType);events++;meta.lastEvent=diagnosticType;metadata(v.response);
  if(type==='response.refusal.delta'||type==='response.refusal.done')throw providerError('PROVIDER_REFUSAL',meta);
  if(type==='error'||type==='response.failed')throw remoteFailure(v.response||v,meta,'PROVIDER_RESPONSE_FAILED');
  if(type==='response.incomplete'){failed(v.response);throw providerError('INVALID_RESPONSE_INCOMPLETE',meta);}
  if(type==='response.output_text.delta'){
   if(typeof v.delta!=='string')throw providerError('PROVIDER_STREAM_PARSE',meta);
   if(!outputText)aiEvent('reading');const key=partKey(v);parts.set(key,(parts.get(key)||'')+v.delta);outputText=[...parts.values()].join('');
  }
  if(type==='response.output_text.done'){
   if(typeof v.text!=='string')throw providerError('PROVIDER_STREAM_PARSE',meta);
   parts.set(partKey(v),v.text);outputText=[...parts.values()].join('');
  }
  if(type==='response.output_item.done'&&v.item?.type==='message'&&Array.isArray(v.item.content)){
   v.item.content.forEach((c,index)=>{if(c?.type==='output_text'&&typeof c.text==='string')parts.set(`${Number.isInteger(v.output_index)?v.output_index:0}:${index}`,c.text);});outputText=[...parts.values()].join('');
  }
  if(type==='response.completed'){
   if(!envelope(v.response)||v.response.status!=='completed')throw providerError('PROVIDER_STREAM_PARSE',meta);
   failed(v.response);completed=true;const finalText=responseText(v.response);if(finalText)outputText=finalText;
  }
  if(outputText.length>1_000_000)throw providerError('PROVIDER_PAYLOAD',meta);
 };
 // Incremental SSE lines retain a trailing CR until the next chunk arrives.
 // Blank lines dispatch one event; multiple data fields join with LF per SSE.
 const feed=(text,final=false)=>{
  lineBuffer+=text;let offset=0;
  for(let i=0;i<lineBuffer.length;i++){
   const ch=lineBuffer[i];if(ch!=='\r'&&ch!=='\n')continue;
   if(ch==='\r'&&i===lineBuffer.length-1&&!final)break;
   const line=lineBuffer.slice(offset,i);if(ch==='\r'&&lineBuffer[i+1]==='\n')i++;offset=i+1;
   if(line===''){accept(frameLines);frameLines=[];}else frameLines.push(line);
  }
  lineBuffer=lineBuffer.slice(offset);
  if(lineBuffer.length+frameLines.reduce((n,l)=>n+l.length,0)>1_000_000)throw providerError('PROVIDER_PAYLOAD',meta);
  if(final){if(lineBuffer)frameLines.push(lineBuffer);lineBuffer='';if(frameLines.length)accept(frameLines);frameLines=[];}
 };
 const detect=final=>{
  const prefix=pending.replace(/^\uFEFF/,'').trimStart();
  if(!prefix&&!final)return;
  if(/^<(?:!doctype\s+html|html\b|head\b|body\b)/i.test(prefix)){meta.responseKind='html';meta.structureKind='html';throw providerError('PROVIDER_RESPONSE_TYPE',meta);}
  if(prefix.startsWith('{')){mode='json';meta.structureKind='json-object';}
  else if(/^(?:event:|data:|:)/.test(prefix)){mode='sse';meta.structureKind='sse-fields';}
  else if(!final&&pending.length<65_536)return;
  else {meta.responseKind='unsupported';meta.structureKind=prefix?'other':'empty';throw providerError(bytes?'PROVIDER_RESPONSE_TYPE':'PROVIDER_STREAM_EMPTY',meta);}
  meta.responseKind=mode;meta.formatDetection=mode==='sse'&&meta.contentType==='text/event-stream'||mode==='json'&&/^application\/(?:[\w.+-]+\+)?json$/.test(meta.contentType)?'mime-and-structure':'structure-fallback';
  if(mode==='sse'){const buffered=prefix;pending='';feed(buffered,final);}
 };
 try{
  if(reader)while(true){
   signal?.throwIfAborted();let chunk;try{chunk=await reader.read();}catch(error){if(signal?.aborted)throw error;throw providerError(bytes?'PROVIDER_STREAM_INTERRUPTED':'PROVIDER_NETWORK',meta,error);}
   bytes+=chunk.value?.byteLength||0;const text=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});
   if(mode==='sse')feed(text,chunk.done);else{pending+=text;if(!mode)detect(chunk.done);if(pending.length>1_000_000)throw providerError('PROVIDER_PAYLOAD',meta);}
   if(chunk.done)break;
  }
  if(!mode)detect(true);
  if(mode==='json'){
   let value;try{value=JSON.parse(pending.replace(/^\uFEFF/,''));}catch{throw providerError(response.ok?'PROVIDER_STREAM_PARSE':'PROVIDER_HTTP',meta);}
   if(!value||typeof value!=='object'||Array.isArray(value))throw providerError(response.ok?'PROVIDER_STREAM_PARSE':'PROVIDER_HTTP',meta);
   structure(value);
   if(!response.ok||value.error||typeof value.detail==='string')throw remoteFailure(value,meta,response.ok?'PROVIDER_JSON_ERROR':'PROVIDER_HTTP');
   if(!envelope(value)){meta.structureKind='json-other';throw providerError('PROVIDER_RESPONSE_TYPE',meta);}
   meta.structureKind='responses-json';metadata(value);failed(value);completed=value.status==='completed';outputText=responseText(value);
  }
  if(!response.ok)throw remoteFailure({},meta,'PROVIDER_HTTP');
  if(!completed)throw providerError('PROVIDER_STREAM_UNFINISHED',meta);
  if(parts.size>1)throw providerError('PROVIDER_OUTPUT_MULTIPLE',meta);
  if(!outputText.trim())throw providerError('PROVIDER_OUTPUT_EMPTY',meta);
  return{outputText,actualReasoning,actualServiceTier,usage,responseModel};
 }finally{
  Object.assign(meta,{responseBytes:bytes,eventCount:events,outputCharacters:outputText.length,eventTypes:[...seenEvents].join(','),topLevelKeys:[...seenKeys].join(','),outputItemTypes:[...seenItems].join(','),unknownKeyCount:unknownKeys,unknownEventCount:unknownEvents,unknownItemTypeCount:unknownItems,actualReasoning,actualServiceTier,...(responseModel?{responseModel}:{}),...(usage?{usage}:{})});
  if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
}
