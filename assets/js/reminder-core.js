(function(global){
'use strict';
const C=global.FitCore,clone=value=>JSON.parse(JSON.stringify(value)),own=(v,k)=>Object.hasOwn(v,k);
const isDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&C.addDays(value,0)===value;
const isTime=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const safeId=value=>typeof value==='string'&&value.length>0&&value.length<=180&&/^[a-zA-Z0-9_-]+$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function initial(){return {version:1,items:[],events:[],settings:{browserAlerts:false}};}
function migrate(data){return data?clone(data):initial();}
function validate(data){
  const fail=error=>({ok:false,error}),object=v=>v&&typeof v==='object'&&!Array.isArray(v),text=(v,max=1000)=>typeof v==='string'&&v.length<=max;
  if(!object(data)||data.version!==1||!Array.isArray(data.items)||data.items.length>1000||!data.items.every(object)||!Array.isArray(data.events)||data.events.length>100000||!data.events.every(object)||!object(data.settings)||typeof data.settings.browserAlerts!=='boolean')return fail('ساختار یادآورها معتبر نیست.');
  if(new Set(data.items.map(v=>v.id)).size!==data.items.length||new Set(data.events.map(v=>v.key)).size!==data.events.length)return fail('شناسهٔ تکراری در یادآورها وجود دارد.');
  for(const item of data.items){
    if(own(item,'excludeDates')&&(!Array.isArray(item.excludeDates)||item.excludeDates.length>10000||!item.excludeDates.every(isDate))||own(item,'date')&&(!isDate(item.date)||item.date<item.startDate||item.endDate&&item.date>item.endDate))return fail('تاریخ استثنا یا نوبت تکی یادآور معتبر نیست.');
    if(!object(item)||!safeId(item.id)||!text(item.name,200)||!item.name.trim()||!['pill','supplement','meal','custom'].includes(item.kind)||!text(item.dose,200)||!text(item.notes)||typeof item.enabled!=='boolean'||!isDate(item.startDate)||item.endDate!==''&&(!isDate(item.endDate)||item.endDate<item.startDate)||!Number.isInteger(item.everyDays)||item.everyDays<1||item.everyDays>365||!['interval','weekdays'].includes(item.repeat)||!Array.isArray(item.weekdays)||item.weekdays.some(v=>!Number.isInteger(v)||v<0||v>6)||new Set(item.weekdays).size!==item.weekdays.length||item.repeat==='weekdays'&&!item.weekdays.length||!Array.isArray(item.times)||!item.times.length||item.times.length>24||!item.times.every(isTime)||new Set(item.times).size!==item.times.length)return fail('نام، بازه، ساعت‌ها یا تکرار یکی از یادآورها معتبر نیست.');
  }
  for(const event of data.events){
    if(!object(event)||!text(event.key,350)||!event.key||!safeId(event.itemId)||!isDate(event.date)||!isTime(event.time)||!['pending','done','skipped','snoozed'].includes(event.status)||!Number.isFinite(event.updatedAt)||event.updatedAt<0||own(event,'snoozeUntil')&&(!Number.isFinite(event.snoozeUntil)||event.snoozeUntil<0)||own(event,'alertedAt')&&(!Number.isFinite(event.alertedAt)||event.alertedAt<0))return fail('سوابق یادآوری معتبر نیست.');
    if(event.key!==occurrenceKey(event.itemId,event.date,event.time))return fail('شناسهٔ سابقهٔ یادآوری با تاریخ و ساعت آن هماهنگ نیست.');
    if(own(event,'name')&&!text(event.name,200)||own(event,'dose')&&!text(event.dose,200)||own(event,'kind')&&!['pill','supplement','meal','custom'].includes(event.kind))return fail('عنوان سابقهٔ یادآور معتبر نیست.');
  }
  return {ok:true,error:''};
}
function occurrenceKey(itemId,date,time){return itemId+'@'+date+'T'+time;}
function scheduled(item,date){
  if(!item||item.enabled===false||!isDate(date)||!isDate(item.startDate)||date<item.startDate||item.endDate&&date>item.endDate)return false;
  if(Array.isArray(item.excludeDates)&&item.excludeDates.includes(date))return false;
  if(item.date)return date===item.date;
  if(item.repeat==='weekdays')return (item.weekdays||[]).includes((new Date(date+'T12:00:00').getDay()+1)%7);
  const interval=Number(item.everyDays)||1;return C.diffDays(date,item.startDate)%interval===0;
}
function combine(data,extra=[]){const map=new Map();for(const item of [...(data?.items||[]),...extra])if(item&&safeId(item.id)&&!map.has(item.id))map.set(item.id,item);return [...map.values()];}
function occurrences(items,from,to,events=[],now=Date.now()){
  if(!isDate(from)||!isDate(to)||to<from||C.diffDays(to,from)>366)return [];
  const byKey=new Map(events.map(event=>[event.key,event])),result=[];
  for(let date=from;date<=to;date=C.addDays(date,1))for(const item of items){if(!scheduled(item,date))continue;for(const time of [...new Set(item.times||[])].filter(isTime).sort()){
    const key=occurrenceKey(item.id,date,time),event=byKey.get(key),at=new Date(date+'T'+time+':00').getTime(),base={key,itemId:item.id,name:item.name,kind:item.kind||'meal',dose:item.dose||'',notes:item.notes||'',date,time,at,event};
    if(event&&['done','skipped','snoozed'].includes(event.status)){if(typeof event.name==='string'&&event.name)base.name=event.name;if(typeof event.dose==='string')base.dose=event.dose;if(typeof event.kind==='string')base.kind=event.kind;}
    let status=event?.status;if(status==='done'||status==='skipped'){}else if(status==='snoozed'&&event.snoozeUntil>now)status='snoozed';else status=at<=now?'due':'upcoming';
    result.push({...base,status,effectiveAt:status==='snoozed'?event.snoozeUntil:at});
  }}
  const projected=new Set(result.map(row=>row.key));for(const event of events)if(event.date>=from&&event.date<=to&&['done','skipped'].includes(event.status)&&!projected.has(event.key)){const item=items.find(row=>row.id===event.itemId),at=new Date(event.date+'T'+event.time+':00').getTime();result.push({key:event.key,itemId:event.itemId,name:event.name||item?.name||'یادآور حذف‌شده',kind:event.kind||item?.kind||'custom',dose:typeof event.dose==='string'?event.dose:item?.dose||'',notes:item?.notes||'',date:event.date,time:event.time,at,effectiveAt:at,event,status:event.status});}
  return result.sort((a,b)=>a.effectiveAt-b.effectiveAt||a.name.localeCompare(b.name,'fa'));
}
function updateEvent(data,occurrence,status,now=Date.now(),snoozeMinutes=10){
  if(!['pending','done','skipped','snoozed'].includes(status)||!isDate(occurrence.date)||!isTime(occurrence.time)||!safeId(occurrence.itemId))throw Error('وضعیت یادآور معتبر نیست.');
  const key=occurrenceKey(occurrence.itemId,occurrence.date,occurrence.time),index=data.events.findIndex(event=>event.key===key),previous=index<0?{}:data.events[index];
  const event={...previous,key,itemId:occurrence.itemId,date:occurrence.date,time:occurrence.time,status,updatedAt:now,name:typeof occurrence.name==='string'?occurrence.name:previous.name||'',dose:typeof occurrence.dose==='string'?occurrence.dose:previous.dose||'',kind:occurrence.kind||previous.kind||'custom'};
  if(status==='snoozed'){event.snoozeUntil=now+Math.min(1440,Math.max(1,Number(snoozeMinutes)||10))*60000;delete event.alertedAt;}else delete event.snoozeUntil;
  if(index<0)data.events.push(event);else data.events[index]=event;return event;
}
function markAlerted(data,occurrence,now=Date.now()){const old=data.events.find(event=>event.key===occurrence.key);if(old?.status==='snoozed'){old.alertedAt=now;old.updatedAt=now;return old;}const event=updateEvent(data,occurrence,'pending',now);event.alertedAt=now;return event;}
function firstScheduled(item){for(let offset=0;offset<370;offset++){const date=C.addDays(item.startDate,offset);if(item.endDate&&date>item.endDate)break;if(scheduled(item,date))return date;}return '';}
function icsEscape(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function foldLine(line){const bytes=value=>new TextEncoder().encode(value).length,out=[];let part='';for(const ch of line){if(bytes(part+ch)>74){out.push(part);part=' '+ch;}else part+=ch;}out.push(part);return out.join('\r\n');}
function calendarFile(items,now=Date.now()){
  const stamp=new Date(now).toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tavan//Persian Workout Journal//FA','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:یادآورهای توان'];
  const weekdayCodes=['SA','SU','MO','TU','WE','TH','FR'];
  for(const item of items){if(item.enabled===false)continue;const first=firstScheduled(item);if(!first)continue;for(const time of [...new Set(item.times||[])].filter(isTime)){
    lines.push('BEGIN:VEVENT','UID:'+icsEscape(item.id+'-'+time.replace(':','')+'@tavan.local'),'DTSTAMP:'+stamp,'DTSTART:'+first.replaceAll('-','')+'T'+time.replace(':','')+'00','SUMMARY:'+icsEscape(item.name),'DESCRIPTION:'+icsEscape([item.dose,item.notes,'این یادآور از برنامهٔ توان صادر شده است.'].filter(Boolean).join('\n')),'TRANSP:TRANSPARENT');
    if(!item.date){let rule=item.repeat==='weekdays'?'FREQ=WEEKLY;BYDAY='+(item.weekdays||[]).map(v=>weekdayCodes[v]).join(','):'FREQ=DAILY;INTERVAL='+(Number(item.everyDays)||1);if(item.endDate)rule+=';UNTIL='+item.endDate.replaceAll('-','')+'T235959';lines.push('RRULE:'+rule);}
    const exceptions=[...new Set(item.excludeDates||[])].filter(isDate);if(exceptions.length)lines.push('EXDATE:'+exceptions.map(date=>date.replaceAll('-','')+'T'+time.replace(':','')+'00').join(','));
    lines.push('BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:'+icsEscape(item.name+(item.dose?' · '+item.dose:'')),'END:VALARM','END:VEVENT');
  }}
  lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
global.ReminderCore={initial,migrate,validate,isDate,isTime,occurrenceKey,scheduled,combine,occurrences,updateEvent,markAlerted,calendarFile,firstScheduled};
})(typeof window!=='undefined'?window:globalThis);
