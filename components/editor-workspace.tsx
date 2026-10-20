'use client';

import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {PanelLeft,PanelRight,X} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from './ui/tabs';

type Side='source'|'inspector';
// Retire only the exact size keys this component previously owned. Editor
// session/drafts/media and unrelated localStorage values are never touched.
const retiredLayouts=[
 ['shortcut-prototype-wide-v1','source:preview:inspector'],
 ['shortcut-prototype-vertical-v1','source:preview:inspector'],
 ['shortcut-prototype-center-v1','preview-area:timeline-area'],
];

export function EditorWorkspace({source,preview,timeline,inspector,status,visible=true}:{source:ReactNode;preview:ReactNode;timeline:ReactNode;inspector:ReactNode;status:ReactNode;visible?:boolean}){
 const [narrow,setNarrow]=useState(false);
 const [collapsed,setCollapsed]=useState({source:false,inspector:false});
 const [drawer,setDrawer]=useState<Side|null>(null);
 const sourcePanel=useRef<HTMLDivElement|null>(null),inspectorPanel=useRef<HTMLDivElement|null>(null);
 const sourceToggle=useRef<HTMLButtonElement|null>(null),inspectorToggle=useRef<HTMLButtonElement|null>(null);
 const sourceClose=useRef<HTMLButtonElement|null>(null),inspectorClose=useRef<HTMLButtonElement|null>(null);

 useEffect(()=>{
  try{
   for(const [id,panels]of retiredLayouts){
    localStorage.removeItem(`react-resizable-panels:${id}`);
    localStorage.removeItem(`react-resizable-panels:${id}:${panels}`);
   }
  }catch{/* Disabled storage must not prevent layout or draft editing. */}
  const query=matchMedia('(max-width: 1050px)');
  const update=()=>{
   // Closing a drawer at a breakpoint must not leave focus in hidden content.
   if(sourcePanel.current?.contains(document.activeElement))sourceToggle.current?.focus();
   else if(inspectorPanel.current?.contains(document.activeElement))inspectorToggle.current?.focus();
   setNarrow(query.matches);setDrawer(null);
  };
  update();query.addEventListener('change',update);
  return()=>query.removeEventListener('change',update);
 },[]);

 const sourceOpen=narrow?drawer==='source':!collapsed.source;
 const inspectorOpen=narrow?drawer==='inspector':!collapsed.inspector;
 function closeDrawer(){
  const previous=drawer;setDrawer(null);
  if(previous==='source')sourceToggle.current?.focus();
  else if(previous==='inspector')inspectorToggle.current?.focus();
 }
 useEffect(()=>{
  if(!visible){setDrawer(null);return;}
  if(!narrow||!drawer)return;
  (drawer==='source'?sourceClose:inspectorClose).current?.focus();
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented)return;
   event.preventDefault();setDrawer(null);
   (drawer==='source'?sourceToggle:inspectorToggle).current?.focus();
  };
  // Bubble: nested Select/Popover can consume Escape before closing the drawer.
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[narrow,drawer,visible]);
 function toggle(side:Side){
  if(narrow)setDrawer(current=>current===side?null:side);
  else setCollapsed(current=>({...current,[side]:!current[side]}));
 }

 return <div className="editor-workspace">
  <div className="studio-fixed-columns" data-source-open={sourceOpen} data-inspector-open={inspectorOpen}>
   {narrow&&drawer&&visible&&<button type="button" tabIndex={-1} className="studio-drawer-backdrop" aria-label="Đóng panel" onClick={closeDrawer}/>}
   <div id="studio-source-column" ref={sourcePanel} className="studio-side-panel studio-source-column" data-drawer-open={narrow&&drawer==='source'&&visible} inert={!sourceOpen||!visible} aria-hidden={!sourceOpen||!visible}>
    <div className="studio-drawer-heading"><strong>Nguồn và AI</strong><button ref={sourceClose} type="button" aria-label="Đóng nguồn" onClick={closeDrawer}><X size={16}/></button></div>
    <EditorSourcePanel>{source}</EditorSourcePanel>
   </div>
   <EditorPreviewPanel preview={preview} timeline={timeline}/>
   <div id="studio-inspector-column" ref={inspectorPanel} className="studio-side-panel studio-inspector-column" data-drawer-open={narrow&&drawer==='inspector'&&visible} inert={!inspectorOpen||!visible} aria-hidden={!inspectorOpen||!visible}>
    <div className="studio-drawer-heading"><strong>Inspector</strong><button ref={inspectorClose} type="button" aria-label="Đóng Inspector" onClick={closeDrawer}><X size={16}/></button></div>
    <div className="studio-inspector-scroll">{inspector}</div>
   </div>
  </div>
  <EditorStatusBar controls={<>
   <button ref={sourceToggle} type="button" aria-controls="studio-source-column" aria-expanded={sourceOpen} title="Thu/mở nguồn" aria-label="Thu/mở nguồn" onClick={()=>toggle('source')}><PanelLeft size={16}/></button>
   <button ref={inspectorToggle} type="button" aria-controls="studio-inspector-column" aria-expanded={inspectorOpen} title="Thu/mở Inspector" aria-label="Thu/mở Inspector" onClick={()=>toggle('inspector')}><PanelRight size={16}/></button>
  </>}>{status}</EditorStatusBar>
 </div>;
}
export function EditorSourcePanel({children}:{children:ReactNode}){
 return <aside aria-label="Nguồn và AI" className="studio-source-panel">{children}</aside>;
}
export function EditorPreviewPanel({preview,timeline}:{preview:ReactNode;timeline:ReactNode}){
 return <div className="studio-center-group">
  <section aria-label="Preview" className="studio-preview-area">{preview}</section>
  <section aria-label="Timeline đang chọn" className="studio-timeline-scroll">{timeline}</section>
 </div>;
}
export function EditorInspector({appearance,text,music,tab,onTab}:{appearance:ReactNode;text:ReactNode;music:ReactNode;tab:string;onTab:(value:string)=>void}){
 return <aside aria-label="Inspector" className="studio-inspector"><Tabs value={tab} onValueChange={onTab}><TabsList className="studio-inspector-tabs"><TabsTrigger value="appearance">Giao diện</TabsTrigger><TabsTrigger value="text">Chữ</TabsTrigger><TabsTrigger value="music">Nhạc</TabsTrigger></TabsList>
  <TabsContent forceMount value="appearance" hidden={tab!=='appearance'} className={tab!=='appearance'?'hidden':'studio-inspector-body'}>{appearance}</TabsContent>
  <TabsContent forceMount value="text" hidden={tab!=='text'} className={tab!=='text'?'hidden':'studio-inspector-body'}>{text}</TabsContent>
  <TabsContent forceMount value="music" hidden={tab!=='music'} className={tab!=='music'?'hidden':'studio-inspector-body'}>{music}</TabsContent>
 </Tabs></aside>;
}
export function EditorStatusBar({children,controls}:{children:ReactNode;controls:ReactNode}){
 return <footer aria-label="Validation và render" className="studio-statusbar"><div className="studio-panel-toggles">{controls}</div>{children}</footer>;
}
