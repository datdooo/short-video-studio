// Explicit user-owned DEV acquisition, not an app startup task. No audio is
// distributed in source/package. Uses the existing bounded hash-safe importer.
import {createMusicLibrary} from '../worker/music-library.mjs';
import {GENTLE_MUSIC_COLLECTION} from '../lib/music/gentle-collection.mjs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,lstat,realpath,readdir,readFile,writeFile,rename,rm,statfs} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform,Readable} from 'node:stream';
import {homedir} from 'node:os';import path from 'node:path';
const project=path.resolve(import.meta.dirname,'..');
if(project!=='/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev'||process.env.SHORTCUT_RUNTIME_PROFILE==='production')throw Error('DEV checkout only.');
const root=path.join(homedir(),'Library/Application Support/ShortCut Studio Dev/media/music');
await mkdir(root,{recursive:true});if((await lstat(root)).isSymbolicLink()||await realpath(root)!==root)throw Error('Unsafe DEV music root.');
if((await statfs(root)).bavail*(await statfs(root)).bsize<1024**3)throw Error('Need1GiB free; no downloads started.');
const reportRoot=path.join(project,'.isolation-verification/gentle-music-20261020');
await mkdir(reportRoot,{recursive:true});if(await realpath(reportRoot)!==reportRoot)throw Error('Unsafe acquisition report root.');
const record=path.join(reportRoot,'install-report.json');
const licenseUrl='https://www.no-copyright-music.com/wp-content/uploads/2023/03/LiborioContiLicense.pdf';
const run=(binary,args,{signal}={})=>new Promise((resolve,reject)=>{
 const proc=spawn(binary,args,{signal,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 proc.stdout.on('data',c=>stdout=(stdout+c).slice(-2*1024**2));proc.stderr.on('data',c=>stderr=(stderr+c).slice(-1024));
 proc.once('error',reject);proc.once('exit',code=>code===0?resolve({stdout,stderr}):reject(Error(path.basename(binary)+' import failed: '+code)));
});
const bin=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin');
const library=createMusicLibrary({root,ffmpeg:path.join(bin,'ffmpeg'),ffprobe:path.join(bin,'ffprobe'),run});
async function bytes(){let n=0;for(const f of await readdir(root)){if(/^[a-f0-9]{64}\.(json|mp3|flac|m4a|aac|opus|ogg)$/.test(f))n+=(await lstat(path.join(root,f))).size;}return n;}
const before=await library.list(),known=new Set(before.map(a=>a.id));
let previous;try{previous=JSON.parse(await readFile(record,'utf8'));}catch{}
const report={startedAt:new Date().toISOString(),initialCount:before.length,initialBytes:await bytes(),budgetBytes:300*1024**2,downloadedBytes:previous?.downloadedBytes||0,tracks:[],errors:[],auditionedCount:0,instrumentalVerifiedCount:0};
const save=()=>writeFile(record,JSON.stringify(report,null,2));
const abort=new AbortController();for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>abort.abort());
async function download(url,file,maxBytes){
 const allowed=new URL(url);if(allowed.origin!=='https://www.no-copyright-music.com'||!allowed.pathname.startsWith('/wp-content/uploads/'))throw Error('Untrusted composer URL.');
 const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(120000)]),response=await fetch(url,{signal,redirect:'error'});
 if(!response.ok)throw Error('Official download HTTP '+response.status);
 const length=Number(response.headers.get('content-length'));
 if(Number.isFinite(length)&&length>maxBytes){await response.body?.cancel();throw Error('Track exceeds remaining download budget.');}
 if(!response.body)throw Error('Missing download body.');
 await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_enc,cb){
   report.downloadedBytes+=chunk.length;
   if(report.downloadedBytes>report.budgetBytes)return cb(Error('300MiB budget exhausted.'));
   cb(null,chunk);
 }}),createWriteStream(file,{flags:'wx'}),{signal});
}
// Small official license evidence stays internal; no credentials/cookies involved.
const licenseResponse=await fetch(licenseUrl,{signal:AbortSignal.timeout(30000),redirect:'error'});
if(!licenseResponse.ok)throw Error('Official license unavailable; no audio downloads started.');
const license=Buffer.from(await licenseResponse.arrayBuffer());if(license.length>1024**2||license.subarray(0,4).toString()!=='%PDF')throw Error('Invalid license document.');
await writeFile(path.join(reportRoot,'composer-license.pdf'),license);
const licenseHash=createHash('sha256').update(license).digest('hex');
for(const track of GENTLE_MUSIC_COLLECTION){
 if(abort.signal.aborted||report.downloadedBytes>=report.budgetBytes)break;
 const installed=before.find(a=>a.catalogId===track.id);
 if(installed){report.tracks.push({id:installed.id,title:installed.title,alreadyPresent:true,mood:installed.mood,bytes:installed.storedBytes});continue;}
 const tmp=path.join(reportRoot,track.id+'.mp3');let asset;
 try{
  // Refuse to remove any previous/inherited intermediate: own new files only.
  try{await lstat(tmp);throw Error('Existing download intermediate retained; inspect before resume.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await download(track.downloadUrl,tmp,Math.min(64*1024**2,report.budgetBytes-report.downloadedBytes));
  asset=await library.import(createReadStream(tmp),{filename:track.title+'.mp3',signal:abort.signal});
  if(known.has(asset.id)){report.tracks.push({id:asset.id,title:asset.title,duplicate:true});}
  else{
    const {file,...metadata}=asset;
    const next={...metadata,...track,catalogId:track.id,id:asset.id,contentHash:asset.id,
      origin:'official-composer-download',license:'Liborio Conti commercial video/media license; attribution optional; no redistribution/Content ID registration',
      licenseUrl,licenseCheckedDate:'2026-10-20',licenseDocumentHash:licenseHash,attributionRequired:false,
      auditioned:false,instrumentalVerified:false,verificationStatus:'official-category-screened; full-file decoded during normal import; no listening audition; vocals/voice samples unverified'};
    const metaTemp=path.join(root,'.gentle-metadata-'+asset.id+'.json');await writeFile(metaTemp,JSON.stringify(next),{flag:'wx'});await rename(metaTemp,path.join(root,asset.id+'.json'));
    known.add(asset.id);report.tracks.push({id:asset.id,catalogId:track.id,title:track.title,mood:track.mood,bytes:asset.storedBytes,duration:asset.duration,new:true});
  }
  console.log('Imported · '+track.title+' · '+Math.round(asset.storedBytes/1024)+'KiB');
 }catch(error){report.errors.push({title:track.title,reason:String(error.message).slice(0,180)});console.log('Skipped · '+track.title+' · '+error.message);}
 finally{if(asset)await rm(tmp,{force:true});await save();}
}
report.finishedAt=new Date().toISOString();report.finalBytes=await bytes();report.addedBytes=report.finalBytes-report.initialBytes;
report.finalCount=(await library.list()).length;report.newCount=report.tracks.filter(t=>t.new).length;
report.gentleNewCount=report.tracks.filter(t=>t.new&&t.mood==='Nhẹ nhàng / Đa dụng').length;
await save();console.log(JSON.stringify({newCount:report.newCount,totalCount:report.finalCount,addedBytes:report.addedBytes,downloadedBytes:report.downloadedBytes,gentleNewCount:report.gentleNewCount,errors:report.errors.length}));
