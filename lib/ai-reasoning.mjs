// API values, not UI labels. Metadata precedes the documented Responses catalog.
// Sources/date: docs/ai-efficiency.md (2026-10-21). Unknown capabilities fail closed.
export const REASONING_POLICY_VERSION='lowest-supported-v1';
// Owner-selected app model. Never interpret desktop labels (Light/Faster) as
// Responses parameters or silently route to a more expensive model.
export const ANALYSIS_MODEL='gpt-6-luna';
// Owner explicitly requested Faster; request Fast, confirm only from response.
export const ANALYSIS_SERVICE_TIER='fast';
const order=['none','minimal','low','medium','high','xhigh','max','ultra'];
export function reasoningCapabilities(model={}){
 const values=model.supported_reasoning_efforts??model.reasoning_efforts??model.reasoning?.supported_efforts;
 if(!Array.isArray(values))return undefined;
 return [...new Set(values.map(v=>typeof v==='string'?v:v?.reasoning_effort??v?.effort).filter(v=>order.includes(v)))];
}
export function lowestReasoning(model,metadata={},adapter='responses'){
 const fail=()=>Object.assign(Error('REASONING_UNSUPPORTED: Chưa xác minh được mức reasoning thấp nhất của model/kết nối này; chưa gửi AI, không tự đổi model.'),{code:'REASONING_UNSUPPORTED'});
 if(adapter!=='responses')throw fail();
 const announced=reasoningCapabilities(metadata);let effort,source;
 if(announced?.length){effort=order.find(v=>announced.includes(v));source='model-metadata';}
 else if(announced)throw fail();
 else{
  const id=String(model).replace(/-\d{4}-\d{2}-\d{2}$/,'');
  if(['gpt-6-astra','gpt-6.1-sol'].includes(id))effort='low';
  else if(['gpt-6-sol','gpt-6-luna','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5','gpt-5.4','gpt-5.4-mini','gpt-5.4-nano','gpt-5.2','gpt-5.1'].includes(id))effort='none';
  else if(['gpt-5','gpt-5-mini','gpt-5-nano'].includes(id))effort='minimal';
  else if(['o1','o3','o3-mini','o4-mini'].includes(id))effort='low';
  source='documented-responses-catalog';
 }
 if(!effort)throw fail();
 return {effort,source,key:`${REASONING_POLICY_VERSION}:${adapter}:${model}:${effort}`};
}
