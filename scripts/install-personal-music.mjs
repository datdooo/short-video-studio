// Explicit DEV-only personal acquisition. No audio enters Git/package; resumable
// by content identity/catalog ID. No Mixkit scraping, credentials or other apps.
import {createMusicLibrary} from '../worker/music-library.mjs';
import {PERSONAL_MUSIC_COLLECTION} from '../lib/music/personal-collection.mjs';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';

import {mkdir,statfs,writeFile,lstat,realpath,rm,readdir} from 'node:fs/promises';
import {homedir} from 'node:os';import path from 'node:path';
const project=path.resolve(import.meta.dirname,'..');
const root=path.join(homedir(),'Library/Application Support/ShortCut Studio Dev/media/music');
if(process.env.SHORTCUT_RUNTIME_PROFILE==='production'||!root.endsWith('/ShortCut Studio Dev/media/music'))throw Error('Refusing non-DEV music root');
await mkdir(root,{recursive:true});if((await lstat(root)).isSymbolicLink()||await realpath(root)!==root)throw Error('Unsafe DEV library');
const disk=await statfs(root);if(disk.bavail*disk.bsize<2*1024**3)throw Error('Need2GiB free for bounded collection acquisition/import');
const run=(binary,args,{signal}={})=>new Promise((resolve,reject)=>{const p=spawn(binary,args,{signal,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',c=>stdout=(stdout+c).slice(-2*1024**2));p.stderr.on('data',c=>stderr=(stderr+c).slice(-1000));p.once('error',reject);p.once('exit',code=>code===0?resolve({stdout,stderr}):reject(Error(path.basename(binary)+' failed ('+code+'): '+stderr.slice(-400))));});
const bin=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin'),library=createMusicLibrary({root,ffmpeg:path.join(bin,'ffmpeg'),ffprobe:path.join(bin,'ffprobe'),run});
const reportPath=path.join(project,'.isolation-verification/adaptive-teaser/collection-install-report.json');
const initial=await library.list(),existing=new Map(initial.filter(a=>a.catalogId).map(a=>[a.catalogId,a]));
const report={root,beforeCount:initial.length,source:'Official Incompetech catalog/static individual MP3 downloads',license:'CC BY4.0; per-track credits retained',fullTrackAuditions:0,sampledAuditions:0,instrumentalVerified:0,tracks:[],errors:[],startedAt:new Date().toISOString()};
const moods=[...new Set(PERSONAL_MUSIC_COLLECTION.map(t=>t.mood))],ordered=Array.from({length:10},(_,i)=>moods.map(m=>PERSONAL_MUSIC_COLLECTION.filter(t=>t.mood===m)[i])).flat().filter(Boolean);
const downloadRoot=path.join(project,'.isolation-verification/adaptive-teaser/music-download-cache');await mkdir(downloadRoot,{recursive:true});if((await lstat(downloadRoot)).isSymbolicLink()||await realpath(downloadRoot)!==downloadRoot)throw Error('Unsafe resume cache');const stop=new AbortController();for(const event of["SIGINT","SIGTERM"])process.once(event,()=>stop.abort());
// Failed partials are resume data: refuse further downloads instead of evicting.
const PARTIAL_LIMIT=512*1024**2,MAX_DOWNLOAD=64*1024**2;
async function partialBytes(){let bytes=0;for(const entry of await readdir(downloadRoot,{withFileTypes:true})){if(!entry.isFile()||!/^incompetech-[a-z0-9]+\.part$/i.test(entry.name))continue;bytes+=(await lstat(path.join(downloadRoot,entry.name))).size;}return bytes;}
let reserved=0;
let cursor=0,saves=Promise.resolve();const save=()=>saves=saves.then(()=>writeFile(reportPath,JSON.stringify(report,null,2)));
async function acquire(){while(cursor<ordered.length&&!stop.signal.aborted){const track=ordered[cursor++];
 if(!track.downloadUrl.startsWith('https://incompetech.com/music/royalty-free/mp3-royaltyfree/'))throw Error('Untrusted download');
 try{
  let asset=existing.get(track.id);
  if(!asset){if(await partialBytes()+reserved+MAX_DOWNLOAD>PARTIAL_LIMIT)throw Error('Resume cache limit512MiB reached; retain partials and stop acquisition');reserved+=MAX_DOWNLOAD;const signal=AbortSignal.any([AbortSignal.timeout(430000),stop.signal]),temp=path.join(downloadRoot,track.id+'.part');
   try{const prior=await lstat(temp).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(prior&&(!prior.isFile()||prior.isSymbolicLink()))throw Error('Unsafe resume file');let downloaded=false;for(let attempt=0;attempt<3;attempt++){try{await run('/usr/bin/curl',['--continue-at','-','--fail','--silent','--show-error','--location','--max-redirs','2','--proto','=https','--max-time','120','--max-filesize',String(64*1024**2),'--output',temp,track.downloadUrl],{signal});downloaded=true;break;}catch(e){if(attempt===2||signal.aborted)throw e;await new Promise(r=>setTimeout(r,1500));}}if(!downloaded)throw Error('Download incomplete');asset=await library.import(createReadStream(temp),{filename:track.filename,catalogId:track.id,officialDownload:true,signal});}
   finally{reserved-=MAX_DOWNLOAD;if(asset)await rm(temp,{force:true});}
  }
  report.tracks.push({id:asset.id,catalogId:track.id,title:track.title,mood:track.mood,duration:asset.duration,bytes:asset.storedBytes,verification:'full-file decoded; official metadata screened; audio audition pending'});
  console.log(`${report.tracks.length}/80 installed · ${track.title}`);
 }catch(e){report.errors.push({catalogId:track.id,error:String(e.message).slice(0,250)});console.log('Unavailable · '+track.title+' · '+e.message);}
 await save();await new Promise(r=>setTimeout(r,1000));
}}
await Promise.all([acquire(),acquire()]);await saves;
report.partialCacheLimitBytes=PARTIAL_LIMIT;report.partialCacheBytes=await partialBytes();report.cancelled=stop.signal.aborted;report.finishedAt=new Date().toISOString();report.totalBytes=report.tracks.reduce((n,t)=>n+(t.bytes||0),0);report.installedCount=report.tracks.length;report.uncertainCount=report.tracks.length;
await writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({installed:report.installedCount,verified:0,uncertain:report.uncertainCount,totalBytes:report.totalBytes,errors:report.errors.length}));
