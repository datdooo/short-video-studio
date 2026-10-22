// Exact app ports, including localhost alias. Native/CLI callers may omit
// Origin; a browser cross-site request may not use that omission as a bypass.
export function createRequestOriginPolicy({webPort,workerPort}){
 const validPort=value=>Number.isInteger(Number(value))&&Number(value)>0&&Number(value)<65536;
 if(!validPort(webPort)||!validPort(workerPort))throw Error('Invalid local app ports for Origin policy.');
 const origins=new Set([webPort,workerPort].flatMap(port=>['127.0.0.1','localhost'].map(host=>`http://${host}:${Number(port)}`)));
 const allowsOrigin=origin=>typeof origin==='string'&&origins.has(origin);
 return{
  allowsOrigin,
  assert(request,pathname){
   const fail=()=>{throw Object.assign(Error('Chỉ cho phép thao tác từ app local đang cấu hình.'),{status:403});};
   if(request.headers.host){
    try{const host=new URL(`http://${request.headers.host}`);if(!['127.0.0.1','localhost'].includes(host.hostname)||Number(host.port||80)!==Number(workerPort)||host.pathname!=='/'||host.username||host.password)fail();}catch{fail();}
   }
   // OAuth redirects are top-level navigation and retain the existing state /
   // single-use-code checks. Do not reinterpret the provider as an app origin.
   if(pathname==='/auth/callback'&&request.method==='GET')return;
   if(pathname.startsWith('/api/')||!['GET','HEAD'].includes(request.method)){
    const origin=request.headers.origin;
    if(origin!==undefined){if(!allowsOrigin(origin))fail();}
    else if(request.headers['sec-fetch-site']==='cross-site'){
     // Native <video> requests can omit Origin while using localhost for the
     // page and 127.0.0.1 for media. Its browser-supplied Referer must still be
     // one of the exact configured app origins.
     let localReferrer=false;try{localReferrer=allowsOrigin(new URL(request.headers.referer).origin);}catch{/* Missing/invalid browser referrer. */}
     if(!localReferrer)fail();
    }
   }
  },
 };
}
