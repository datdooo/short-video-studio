'use client';
import {TaskProgress} from './task-progress';
import {uploadJson,type UploadMetric} from '@/lib/upload-json';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState}from'react';
import {useEditorDraft,useDraftActivity} from './editor-draft-context';
import type{RefObject}from'react';
import type{EditPart,EditPlan}from'@/lib/edit-plan';
import {normalizeMusic,effectiveMusic}from'@/lib/music/settings.mjs';
import type{MusicSettings,SpeechActivity}from'@/lib/music/settings.mjs';
import {PREVIEW_RATE,PREVIEW_TIMEBASE,PREVIEW_MIX_VERSION} from '@/lib/preview-config.mjs';
import {createMusicPlayback} from '@/lib/music/preview-playback.mjs';
import {MUSIC_CATALOG}from'@/lib/music/catalog.mjs';
type Asset={id:string;title:string;duration:number;durationLoop:number;contentHash:string;artist?:string;mood?:string;catalogId?:string;license?:string;sourceUrl?:string;attribution?:string;verificationStatus?:string;instrumentalVerified?:boolean};
type Props={suspended?:boolean;autoPrepare?:boolean;previewReady:boolean;plan:EditPlan;worker:string;settings?:MusicSettings;activity?:SpeechActivity;source?:{id:string;duration:number}|null;part:EditPart;duration:number;time:number;playing:boolean;video:RefObject<HTMLVideoElement|null>;onChange:(v:MusicSettings)=>void;onSpeech:(v:SpeechActivity)=>void;onAudition:()=>void;onPlayback?:(handle:{play:()=>void;pause:()=>void}|null)=>void};
// Pausing alone retains the audition's downloaded buffer and decoder. Audition
// stop is terminal; a new explicit listen creates a new element when needed.
function releaseMusicElement(element:HTMLAudioElement){
 element.onended=null;element.onerror=null;element.onloadedmetadata=null;element.pause();element.removeAttribute('src');element.load();
}
export function MusicPanel(props:Props){
 const settings=useMemo(()=>normalizeMusic(props.settings),[props.settings]),effective=useMemo(()=>effectiveMusic(props.settings,props.part.id),[props.settings,props.part.id]);
 const [importStartedAt,setImportStartedAt]=useState(0),[mixStartedAt,setMixStartedAt]=useState(0),[detectionStartedAt,setDetectionStartedAt]=useState(0),[importProgress,setImportProgress]=useState<UploadMetric|null>(null),[importTransferred,setImportTransferred]=useState(false);
 const importing=useRef(false),importRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>importRequest.current?.abort(),[]);
 const [assets,setAssets]=useState<Asset[]>([]),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[detecting,setDetecting]=useState(false),[auditionId,setAuditionId]=useState(''),[previewStatus,setPreviewStatus]=useState('off'),[previewAttempt,setPreviewAttempt]=useState(0);
 const libraryRequest=useRef<AbortController|null>(null);
 const[catalogId,setCatalogId]=useEditorDraft('music-catalog','',v=>typeof v==='string'),[search,setSearch]=useEditorDraft('music-search','',v=>typeof v==='string'),[moodFilter,setMoodFilter]=useEditorDraft('music-mood','all',v=>typeof v==='string');
 useDraftActivity('import nhạc',busy);
 const audition=useRef<HTMLAudioElement|null>(null),music=useRef<HTMLAudioElement|null>(null),latest=useRef(props),session=useRef(''),musicSource=useRef(''),expectedMixKey=useRef('');
 const auditionEpoch=useRef(0),auditionStarting=useRef(false);
 const releaseAudition=useCallback(()=>{auditionEpoch.current++;auditionStarting.current=false;const element=audition.current;audition.current=null;if(element)releaseMusicElement(element);},[]);
 const stopAudition=useCallback(()=>{releaseAudition();setAuditionId('');},[releaseAudition]);
 const playback=useRef<ReturnType<typeof createMusicPlayback>|null>(null),onPlayback=props.onPlayback;
 useEffect(()=>{const controller=createMusicPlayback({read:()=>{const p=latest.current;return{audio:music.current,video:p.video.current,key:musicSource.current,expectedKey:expectedMixKey.current,playing:!p.suspended&&p.playing,time:p.time,duration:p.duration};},onStatus:(status,message)=>{setPreviewStatus(status);if(status==='blocked')setError('Trình duyệt chặn audio mix: '+message+'. Bấm Phát nhạc trong preview để cấp thao tác phát. Tiếng source được giữ.');}});playback.current=controller;onPlayback?.({play:()=>{if(latest.current.suspended)return;stopAudition();void controller.play(true);},pause:()=>{stopAudition();controller.pause();}});return()=>{releaseAudition();controller.dispose();playback.current=null;onPlayback?.(null);};},[onPlayback,stopAudition,releaseAudition]);
 useLayoutEffect(()=>{latest.current=props;},[props]);
 useLayoutEffect(()=>{if(props.suspended){stopAudition();playback.current?.pause();}},[props.suspended,stopAudition]);
 useEffect(()=>{if(!session.current)session.current=crypto.randomUUID();},[]);
 const refresh=useCallback(async()=>{
  // Initial load, manual refresh and post-import refresh share one revision.
  // A slower pre-import response must not replace the newly imported list.
  libraryRequest.current?.abort();const controller=new AbortController();libraryRequest.current=controller;setRefreshing(true);
  try{const r=await fetch(props.worker+'/api/music',{signal:controller.signal});const d=await r.json() as {error?:string;assets?:Asset[]};if(!r.ok||!Array.isArray(d.assets))throw Error(d.error||'Không tải được thư viện nhạc.');if(!controller.signal.aborted&&libraryRequest.current===controller)setAssets(d.assets);}
  catch(e){if(!controller.signal.aborted&&libraryRequest.current===controller)setError(String(e instanceof Error?e.message:e));}
  finally{if(libraryRequest.current===controller){libraryRequest.current=null;if(!controller.signal.aborted)setRefreshing(false);}}
 },[props.worker]);
 useEffect(()=>{void refresh();return()=>{libraryRequest.current?.abort();};},[refresh]);
 const [duckingInfo,setDuckingInfo]=useState<{key:string;applied:boolean;windowCount:number;reason:string}|null>(null);
 const speechRef=useRef(props.onSpeech);
 useEffect(()=>{speechRef.current=props.onSpeech;},[props.onSpeech]);
 const sourceId=props.source?.id;
 // An audition belongs to the displayed source/part/asset, even when the next
 // part inherits the same song. Never leave the old audio playing behind it.
 useLayoutEffect(()=>{stopAudition();},[props.worker,sourceId,props.part.id,effective.assetId,settings.enabled,stopAudition]);
 useEffect(()=>{if(props.autoPrepare===false||!settings.enabled||!settings.ducking||!sourceId||props.activity?.sourceId===sourceId){setDetecting(false);return;}const controller=new AbortController();let active=true;
 void Promise.resolve().then(()=>{if(active){setDetecting(true);setDetectionStartedAt(Date.now());}return fetch(`${props.worker}/api/sources/${sourceId}/music-speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal});}).then(async r=>{const value=await r.json() as SpeechActivity & {error?:string};if(!r.ok)throw Error(value.error||'Không phân tích được lời nói.');if(active)speechRef.current(value);}).catch(e=>{if(active)setError('Ducking chưa khả dụng; giữ gain thủ công. '+e.message);}).finally(()=>{if(active)setDetecting(false);});
 return()=>{active=false;controller.abort();};},[settings.enabled,settings.ducking,sourceId,props.worker,props.autoPrepare,props.activity?.sourceId]);
 // Shared mix/envelope helper, with explicit Preview 1× mapping; BGM stays 1×.
 // Native playback avoids
 // the demonstrated Web Audio clock stall; video source/cuts remain untouched.
 const previewKey=useMemo(()=>JSON.stringify([PREVIEW_MIX_VERSION,PREVIEW_RATE,PREVIEW_TIMEBASE,props.autoPrepare,props.previewReady,sourceId,settings,effective.assetId,props.part.id,props.part.segments,props.part.teaser,props.part.teaserEnabled!==false,props.activity?.cacheKey]),[props.autoPrepare,props.previewReady,sourceId,settings,effective.assetId,props.part.id,props.part.segments,props.part.teaser,props.part.teaserEnabled,props.activity?.cacheKey]);
 useEffect(()=>{expectedMixKey.current=previewKey;playback.current?.invalidate();musicSource.current='';const oldMix=music.current;music.current=null;if(oldMix)releaseMusicElement(oldMix);const video=latest.current.video.current;if(props.autoPrepare===false||!props.previewReady||!settings.enabled||!effective.enabled||!effective.assetId||!sourceId){music.current?.pause();if(video)video.muted=false;void Promise.resolve().then(()=>setPreviewStatus(props.autoPrepare===false?'restored':!props.previewReady?'waiting-plan':settings.enabled?'missing':'off'));return;}
 const controller=new AbortController();let active=true,pending:HTMLAudioElement|undefined;const timer=setTimeout(()=>{
 setPreviewStatus('preparing');setMixStartedAt(Date.now());setError('');
 void fetch(props.worker+'/api/music/preview',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId,plan:latest.current.plan,partId:latest.current.part.id,sessionId:session.current,previewRate:PREVIEW_RATE,clockVersion:PREVIEW_TIMEBASE})}).then(async r=>{const d=await r.json() as {id?:string;rate?:number;clockVersion?:string;mixVersion?:string;ducking?:{applied:boolean;windowCount:number;reason:string};error?:string};if(!r.ok||!d.id)throw Error(d.error||'Audio preview failed');if(d.rate!==PREVIEW_RATE||d.clockVersion!==PREVIEW_TIMEBASE||d.mixVersion!==PREVIEW_MIX_VERSION)throw Error('Worker chưa hỗ trợ mix Preview 1×/ducking mới. Khi job kết thúc, mở lại bản DEV mới; không dùng mix 1.25× cũ.');if(!active)return;if(d.ducking)setDuckingInfo({key:previewKey,...d.ducking});const previous=music.current,element=new Audio(`${props.worker}/api/music/preview/${d.id}/media`);pending=element;element.preload='auto';element.playbackRate=1;element.onloadedmetadata=()=>{if(!active){releaseMusicElement(element);return;}if(previous)releaseMusicElement(previous);music.current=element;const p=latest.current;musicSource.current=previewKey;element.currentTime=Math.max(0,Math.min(p.time,element.duration));playback.current?.ready();};element.onerror=()=>{if(active){playback.current?.pause();musicSource.current='';setPreviewStatus('error');setError('Không đọc được file nhạc preview. Bấm Chuẩn bị lại nhạc.');}};}).catch(e=>{if(active){music.current?.pause();musicSource.current='';const video=latest.current.video.current;if(video)video.muted=false;setPreviewStatus('error');setError('Preview nhạc chưa khả dụng; giữ tiếng source: '+e.message.slice(0,300));}});},180);
 return()=>{active=false;clearTimeout(timer);controller.abort();if(pending){releaseMusicElement(pending);if(music.current===pending){music.current=null;musicSource.current='';}}};
 // Keys contain audio inputs only, excluding visual style and unrelated callbacks.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[previewKey,props.worker,previewAttempt]);
 useEffect(()=>{if(props.suspended)return;let active=true,frame=0;const tick=()=>{if(!active||latest.current.suspended)return;const p=latest.current;if(p.playing&&audition.current&&!audition.current.paused)stopAudition();playback.current?.tick();if(active&&p.playing)frame=requestAnimationFrame(tick);};tick();return()=>{active=false;cancelAnimationFrame(frame);};},[props.suspended,props.playing,stopAudition]);
 // Paused seeks/readiness need one synchronization, not an idle 60Hz poll.
 useEffect(()=>{if(!props.suspended&&!props.playing)playback.current?.tick();},[props.suspended,props.playing,props.time,previewKey,previewStatus]);
 useEffect(()=>{const video=props.video.current;return()=>{const element=music.current;music.current=null;musicSource.current='';if(element)releaseMusicElement(element);releaseAudition();if(video)video.muted=false;};},[props.video,releaseAudition]);
 useEffect(()=>{if(audition.current)audition.current.volume=settings.volume/100;},[settings.volume]);
 async function importFile(file?:File){if(!file||importing.current)return;importing.current=true;const owner=props.source?.id;const controller=new AbortController();importRequest.current=controller;setImportStartedAt(Date.now());setImportProgress(null);setImportTransferred(false);setBusy(true);setError('');try{const d=await uploadJson<{error?:string;asset:Asset}>(props.worker+'/api/music/import',file,{signal:controller.signal,headers:{'Content-Type':'application/octet-stream','X-Filename':encodeURIComponent(file.name),'X-Catalog-Id':catalogId},onProgress:setImportProgress,onTransferred:()=>setImportTransferred(true)});if(controller.signal.aborted)return;await refresh();if(controller.signal.aborted||latest.current.source?.id!==owner)return;latest.current.onChange({...normalizeMusic(latest.current.settings),assetId:d.asset.id});}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}finally{if(importRequest.current===controller){importRequest.current=null;importing.current=false;setBusy(false);}}}

 function listen(){
  if(latest.current.suspended||!effective.assetId)return;
  if(auditionId||auditionStarting.current){stopAudition();return;}
  props.onAudition();playback.current?.pause();stopAudition();
  const generation=++auditionEpoch.current,assetId=effective.assetId,a=new Audio(`${props.worker}/api/music/${assetId}/media`);
  audition.current=a;auditionStarting.current=true;a.volume=settings.volume/100;
  const current=()=>audition.current===a&&auditionEpoch.current===generation&&!latest.current.suspended;
  a.onended=()=>{if(current())stopAudition();else releaseMusicElement(a);};
  a.onerror=()=>{if(current()){stopAudition();setError('Không đọc được file nhạc nghe thử.');}else releaseMusicElement(a);};
  void a.play().then(()=>{if(!current()){releaseMusicElement(a);return;}auditionStarting.current=false;setAuditionId(assetId);}).catch(e=>{if(current()){stopAudition();setError(e.message);}});
 }
 // Priority affects presentation only; IDs/settings/audio identity stay unchanged.
 const orderedAssets=useMemo(()=>[...assets].sort((a,b)=>Number(b.mood==='Nhẹ nhàng / Đa dụng')-Number(a.mood==='Nhẹ nhàng / Đa dụng')),[assets]);
 const selectedAsset=assets.find(a=>a.id===effective.assetId),filtered=useMemo(()=>orderedAssets.filter(a=>(moodFilter==='all'||(a.mood||'Nhạc cục bộ')===moodFilter)&&(a.title+' '+(a.artist||'')).toLowerCase().includes(search.toLowerCase())||a.id===settings.assetId||a.id===effective.assetId),[orderedAssets,moodFilter,search,settings.assetId,effective.assetId]);
 return <><details className="studio-disclosure mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4"><summary className="cursor-pointer text-sm font-semibold">Nhạc nền · {settings.enabled?'Bật':'Tắt'}{settings.enabled&&!selectedAsset?' · chưa có file được chọn':''}</summary><div className="mt-3 space-y-3 text-xs">
 <label className="flex items-center gap-2"><input type="checkbox" checked={settings.enabled} onChange={e=>props.onChange({...settings,enabled:e.target.checked})}/>Bật nhạc nền</label>
 <p role="status" className="text-zinc-400">{props.suspended?'Preview nhạc đang tạm dừng.':!settings.enabled?'Preview nhạc đang tắt.':!effective.assetId?'Chưa chọn file nhạc.':!props.previewReady?'Chưa có bản cắt để chuẩn bị nhạc preview.':!selectedAsset?'Không tìm thấy file nhạc đã chọn trong thư viện.':props.autoPrepare===false?'Bấm Play preview để chuẩn bị nhạc.':previewStatus==='preparing'?'Đang chuẩn bị audio mix cho part hiện tại…':previewStatus==='blocked'?'Audio bị chặn — bấm nút phát nhạc.':previewStatus==='error'?'Audio mix lỗi; tiếng source vẫn được giữ.':auditionId?'Đang nghe thử nhạc riêng.':previewStatus==='playing'?'Đang phát giọng nguồn và nhạc.':previewStatus==='ready'||previewStatus==='paused'?'Nhạc preview sẵn sàng.':'Chưa phát nhạc preview.'}</p>
 {(busy||previewStatus==='preparing'||detecting)&&<TaskProgress label={busy?importTransferred?'Kiểm tra và lưu nhạc':'Truyền file nhạc':detecting?'Phân tích lời nói cho ducking':'Chuẩn bị audio mix'} percent={busy&&!importTransferred?importProgress?.percent:null} startedAt={busy?importStartedAt:detecting?detectionStartedAt:mixStartedAt}/>}
 {previewStatus==='error'&&<button type="button" disabled={props.suspended||!effective.enabled||!effective.assetId||!sourceId||!props.previewReady} onClick={()=>setPreviewAttempt(value=>value+1)} className="rounded border border-white/15 px-3 py-2">Chuẩn bị lại nhạc</button>}
 {previewStatus==='blocked'&&<button type="button" disabled={props.suspended} onClick={()=>{if(!latest.current.suspended){stopAudition();void playback.current?.play(true);}}} className="rounded border border-white/15 px-3 py-2">Phát nhạc trong preview</button>}
 <label className="block">Tìm nhạc đã cài<input aria-label="Tìm nhạc đã cài" className="studio-input mt-1 w-full" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="block">Mood<select aria-label="Lọc mood nhạc" className="studio-input mt-1 w-full" value={moodFilter} onChange={e=>setMoodFilter(e.target.value)}><option value="all">Tất cả ({assets.length} đã cài)</option>{[...new Set(orderedAssets.map(a=>a.mood||'Nhạc cục bộ'))].map(m=><option key={m} value={m}>{m}</option>)}</select></label>
 <label className="block">Nhạc chung cho hai part<select aria-label="Nhạc nền" className="studio-input mt-1 w-full" value={settings.assetId||''} onChange={e=>{stopAudition();props.onChange({...settings,assetId:e.target.value||undefined});}}><option value="">Chọn nhạc đã import</option>{[...new Set(filtered.map(a=>a.mood||"Nhạc cục bộ"))].map(mood=><optgroup key={mood} label={mood}>{filtered.filter(a=>(a.mood||"Nhạc cục bộ")===mood).map(a=><option key={a.id} value={a.id}>{a.title} · đã cài{a.artist?` — ${a.artist}`:""}</option>)}</optgroup>)}</select></label>
 <label className="block">Riêng Part {props.part.id}<select aria-label="Nhạc riêng part" className="studio-input mt-1 w-full" value={settings.overrides?.[props.part.id]===null?'none':settings.overrides?.[props.part.id]||'inherit'} onChange={e=>{const overrides={...settings.overrides};if(e.target.value==='inherit')delete overrides[props.part.id];else overrides[props.part.id]=e.target.value==='none'?null:e.target.value;props.onChange({...settings,overrides});}}><option value="inherit">Dùng nhạc chung</option><option value="none">Không nhạc ở part này</option>{orderedAssets.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
 <label className="block">Âm lượng nhạc: {settings.volume}%<input aria-label="Âm lượng nhạc" className="mt-2 w-full" type="range" min="0" max="100" value={settings.volume} onChange={e=>props.onChange({...settings,volume:Number(e.target.value)})}/></label>
 <label className="flex items-center gap-2"><input type="checkbox" checked={settings.ducking} onChange={e=>props.onChange({...settings,ducking:e.target.checked})}/>Tự giảm nhạc khi có lời nói</label>
 <p className="text-zinc-500">{detecting?'Đang phát hiện lời nói cục bộ…':props.activity&&props.activity.sourceId===props.source?.id?props.activity.status==='available'?`${props.activity.intervals.length} khoảng lời nói`:props.activity.limitations.join(' '):'Chưa có dữ liệu lời nói để giảm nhạc tự động.'}</p>
 {settings.enabled&&settings.ducking&&duckingInfo?.key===previewKey&&<p role="status" className="text-zinc-400">{duckingInfo.reason} {duckingInfo.applied?`${duckingInfo.windowCount} vùng giảm nhạc trong Part ${props.part.id} · preview 1×.`:''}</p>}
 <label className="block">Nguồn file sẽ import<select aria-label="Nguồn nhạc import" className="studio-input mt-1 w-full" value={catalogId} onChange={e=>setCatalogId(e.target.value)}><option value="">File riêng · quyền sử dụng do bạn xác nhận</option>{MUSIC_CATALOG.map(t=><option key={t.id} value={t.id}>{t.mood} · {t.title} — {t.artist}</option>)}</select></label><div className="studio-action-row"><button type="button" disabled={props.suspended||!effective.assetId} onClick={listen} className="rounded border border-white/15 px-3 py-2 disabled:opacity-40">{auditionId?'Dừng nghe thử':'Nghe thử nhạc'}</button><label className="cursor-pointer rounded border border-white/15 px-3 py-2">{busy?'Đang import…':'Import nhạc cục bộ'}<input aria-label="Import nhạc cục bộ" className="sr-only" type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.opus" disabled={busy} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label><button type="button" disabled={refreshing||busy} onClick={()=>void refresh()}>{refreshing?'Đang đọc nhạc…':'Làm mới'}</button></div>
 <details><summary className="cursor-pointer">Gợi ý Mixkit theo mục đích · link chính thức</summary><p className="mt-2 text-zinc-500">Link tham khảo · chưa xác minh không lời/quyền dùng từng bài.</p>{[...new Set(MUSIC_CATALOG.filter(t=>!("downloadUrl" in t)).map(t=>t.mood))].map(mood=><div key={mood} className="mt-3"><p>{mood}</p>{MUSIC_CATALOG.filter(t=>!("downloadUrl" in t)&&t.mood===mood).map(t=><a key={t.id} className="mt-1 block text-zinc-400 underline" href={t.sourceUrl} target="_blank" rel="noreferrer">{t.title} — {t.artist}</a>)}</div>)}<a className="mt-3 block underline" href="https://mixkit.co/license/modal/musicFree/" target="_blank" rel="noreferrer">Giấy phép Mixkit</a></details>
 {error&&<p role="alert" className="text-amber-300">{error}</p>}
 </div></details></>;
}
