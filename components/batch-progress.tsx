'use client';
import {TaskProgress} from './task-progress';
export function BatchProgress({items}:{items:{state:string}[]}){
 const done=items.filter(i=>i.state==='done').length,error=items.filter(i=>i.state==='error').length,cancelled=items.filter(i=>i.state==='cancelled').length;
 const ended=done+error+cancelled,review=items.filter(i=>['paused','awaiting-import','review-required'].includes(i.state)).length;
 if(!items.length)return null;
 return <TaskProgress label={`${ended}/${items.length} item kết thúc`} percent={ended/items.length*100} scope="item kết thúc" state={ended===items.length?'done':'waiting'} detail={`Thành công ${done} · lỗi ${error} · hủy ${cancelled}${review?` · cần xử lý ${review}`:''}`}/>;
}
