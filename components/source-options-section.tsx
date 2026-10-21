'use client';

import {useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';

// Keep children mounted so folding a section never resets inputs or drafts.
export function SourceOptionsSection({id,label,children,className,open,onOpenChange}:{
 id:string;label:string;children:ReactNode;className?:string;
 open?:boolean;onOpenChange?:(open:boolean)=>void;
}){
 const [localOpen,setLocalOpen]=useState(false);
 const expanded=open??localOpen;
 return <section className={cn('studio-source-disclosure',className)}>
  <Button id={`${id}-trigger`} type="button" variant="outline"
   className="studio-source-disclosure-trigger" aria-expanded={expanded} aria-controls={`${id}-content`}
   onClick={()=>{if(open===undefined)setLocalOpen(!expanded);onOpenChange?.(!expanded);}}>
   <span>{label}</span><ChevronDown aria-hidden="true" className={expanded?'rotate-180':undefined}/>
  </Button>
  <div id={`${id}-content`} hidden={!expanded} className="studio-source-disclosure-content">{children}</div>
 </section>;
}
