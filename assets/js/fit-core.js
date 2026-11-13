(function (global) {
  'use strict';

  const MS_DAY = 86400000;
  let sequence = 0;
  function uid() {
    return global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function pad(value) { return String(value).padStart(2, '0'); }
  function dateString(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function today() { return dateString(new Date()); }
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return dateString(date) === value ? date : null;
  }
  function addDays(value, count) {
    const date = parseDate(value);
    if (!date || !Number.isFinite(count)) return '';
    date.setDate(date.getDate() + Math.trunc(count));
    return dateString(date);
  }
  function diffDays(a, b) {
    const ad = parseDate(a), bd = parseDate(b);
    if (!ad || !bd) return NaN;
    return Math.round((Date.UTC(ad.getFullYear(), ad.getMonth(), ad.getDate()) - Date.UTC(bd.getFullYear(), bd.getMonth(), bd.getDate())) / MS_DAY);
  }
  function weekStart(value, firstDay=0) {
    const date = parseDate(value);
    if (!date || !Number.isInteger(firstDay) || firstDay<0 || firstDay>6) return '';
    const canonicalDay=(date.getDay()+1)%7;
    return addDays(value,-((canonicalDay-firstDay+7)%7));
  }
  function monthStart(value) {
    const date = parseDate(value);
    if (!date) return '';
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {day:'numeric'}).formatToParts(date);
    const day = Number(parts.find(part => part.type === 'day').value);
    return addDays(value, 1 - day);
  }
  const persianFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {year:'numeric',month:'numeric',day:'numeric'});
  function toPersianParts(value) {
    const date = parseDate(value);
    if (!date) return null;
    const parts = persianFormatter.formatToParts(date);
    return Object.fromEntries(['year','month','day'].map(key => [key, Number(parts.find(part => part.type === key).value)]));
  }
  function fromPersian(year, month, day) {
    if (![year,month,day].every(Number.isInteger) || year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31 || (month > 6 && day > 30)) return '';
    // Locate Farvardin 1 with Intl's Persian calendar, then offset by month.
    // This avoids a second calendar algorithm drifting from chart grouping.
    for (let gregorianDay = 18; gregorianDay <= 23; gregorianDay++) {
      const candidate = String(year + 621) + '-03-' + pad(gregorianDay);
      const parts = toPersianParts(candidate);
      if (!parts || parts.year !== year || parts.month !== 1 || parts.day !== 1) continue;
      const offset = month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30;
      const result = addDays(candidate, offset + day - 1), actual = toPersianParts(result);
      return actual && actual.year === year && actual.month === month && actual.day === day ? result : '';
    }
    return '';
  }
  const calendars = new Set(['persian','gregory','islamic-civil']);
  const calendarFormatters = new Map();
  function calendarParts(value, calendar='persian') {
    const date = parseDate(value);
    if (!date || !calendars.has(calendar)) return null;
    if (calendar === 'persian') return toPersianParts(value);
    if (calendar === 'gregory') return {year:date.getFullYear(),month:date.getMonth()+1,day:date.getDate()};
    if (!calendarFormatters.has(calendar)) calendarFormatters.set(calendar,new Intl.DateTimeFormat('en-US',{calendar,numberingSystem:'latn',timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'}));
    // Construct the ISO day's UTC noon explicitly, independent of the browser's zone.
    const utc = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate(),12));
    const parts = calendarFormatters.get(calendar).formatToParts(utc);
    return Object.fromEntries(['year','month','day'].map(key=>[key,Number(parts.find(part=>part.type===key).value)]));
  }
  function fromCalendar(year, month, day, calendar='persian') {
    if (!calendars.has(calendar) || ![year,month,day].every(Number.isInteger) || year<1 || month<1 || month>12 || day<1 || day>31) return '';
    if (calendar === 'persian') return fromPersian(year,month,day);
    if (calendar === 'gregory') {
      if (year<1000 || year>9999) return '';
      const value=year+'-'+pad(month)+'-'+pad(day);
      return parseDate(value) ? value : '';
    }
    if (day>30) return '';
    // Civil Hijri is deterministic. Search the supported ISO range rather than
    // mixing an arithmetic calendar formula with Intl's displayed calendar.
    let low=Math.floor(Date.UTC(1800,0,1)/MS_DAY),high=Math.floor(Date.UTC(2300,11,31)/MS_DAY);
    const target=year*372+(month-1)*31+day-1;
    while(low<=high){
      const middle=Math.floor((low+high)/2),value=new Date(middle*MS_DAY).toISOString().slice(0,10),parts=calendarParts(value,calendar);
      const key=parts.year*372+(parts.month-1)*31+parts.day-1;
      if(key===target)return value;
      if(key<target)low=middle+1;else high=middle-1;
    }
    return '';
  }
  function calendarMonthStart(value, calendar='persian') {
    const parts=calendarParts(value,calendar);
    return parts ? addDays(value,1-parts.day) : '';
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  const defaultSetProfiles={normal:[1,'working'],warmup:[1,'warmup'],light:[1,'working'],'rest-pause':[2,'working'],drop:[3,'working'],cluster:[4,'working'],rest20:[2,'working'],superset:[1,'working']};
  function setProfile(state,typeId) {
    const types=state&&state.setTypes||[],definition=types.find(type=>type.id===typeId)||types.find(type=>type.id==='normal')||types[0]||{id:'normal',name:'ست اصلی',description:''};
    const fallback=defaultSetProfiles[definition.id]||[1,'working'];
    return {...definition,partCount:Number.isInteger(definition.partCount)&&definition.partCount>=1&&definition.partCount<=20?definition.partCount:fallback[0],kind:['working','warmup'].includes(definition.kind)?definition.kind:fallback[1]};
  }
  function weekTypeSetId(state,weekType,index=0) {
    const types=state&&state.setTypes||[],has=id=>types.some(type=>type.id===id),week=weekType||{};
    const selected=index===1?week.set2TypeId:week.set1TypeId;
    const legacy=index===1?(week.id==='B'?'rest-pause':week.id==='A'?'light':'normal'):'normal';
    return has(selected)?selected:has(legacy)?legacy:has('normal')?'normal':types[0]?.id||'normal';
  }
  function createSet(state,weekType,index=0,warmup=false) {
    const typeId=warmup?(state.setTypes||[]).find(type=>setProfile(state,type.id).kind==='warmup')?.id||weekTypeSetId(state,weekType,index):weekTypeSetId(state,weekType,index);
    const profile=setProfile(state,typeId);
    return {id:uid(),typeId:profile.id,typeName:profile.name||'',warmup:warmup||profile.kind==='warmup',status:'completed',weight:'',reps:'',rir:'',tempo:'',notes:'',segments:Array.from({length:profile.partCount-1},()=>({weight:'',reps:''}))};
  }
  function migrate(data) {
    const next = clone(data);
    if (next.version === 1) {
      next.version = 2;
      // A draft can be saved before the migrated main state is persisted.
      // Stable identity keeps that draft attached after another v1 reload.
      next.periods = [{id:'legacy-period-v1',name:'برنامهٔ اولیه',startDate:'2026-03-21',endDate:'',cycleAnchor:weekStart(next.settings.cycleAnchor,next.settings.weekStartDay==null?0:next.settings.weekStartDay),weekTypes:clone(next.weekTypes),plans:clone(next.plans),weekOverrides:{},dayOverrides:{},notes:''}];
      for (const session of next.sessions) {
        const period = session.date >= next.periods[0].startDate ? next.periods[0] : null;
        if (!Object.prototype.hasOwnProperty.call(session,'periodId')) session.periodId = period ? period.id : '';
        if (!Object.prototype.hasOwnProperty.call(session,'periodName')) session.periodName = period ? period.name : '';
      }
    }
    // Definition defaults can evolve without rewriting any historical set,
    // protocol snapshot, amount or explicitly chosen custom definition.
    for(const type of next.setTypes||[]){const profile=setProfile(next,type.id);if(type.partCount==null)type.partCount=profile.partCount;if(type.kind==null)type.kind=profile.kind;}
    for(const context of [next,...(next.periods||[])])for(const week of context.weekTypes||[]){if(week.set1TypeId==null)week.set1TypeId=weekTypeSetId(next,week,0);if(week.set2TypeId==null)week.set2TypeId=weekTypeSetId(next,week,1);}
    return next;
  }
  function periodForDate(state, value) {
    if (!parseDate(value)) return null;
    return (state.periods || []).find(period => value >= period.startDate && (!period.endDate || value <= period.endDate)) || null;
  }
  function contextForDate(state, value) { return periodForDate(state,value) || state; }
  function weekTypeFor(state, value) {
    const context = contextForDate(state, value), types = context.weekTypes || [];
    if (!types.length) return null;
    const firstDay=state.settings && state.settings.weekStartDay != null ? state.settings.weekStartDay : 0;
    const dayType=context.dayWeekTypes && context.dayWeekTypes[value];
    if(dayType){const selected=types.find(type=>type.id===dayType);if(selected)return selected;}
    const override = context.weekOverrides && context.weekOverrides[weekStart(value,firstDay)];
    if (override && override.weekTypeId) {
      const selected = types.find(type => type.id === override.weekTypeId);
      if (selected) return selected;
    }
    const anchor = weekStart(context.cycleAnchor || context.settings && context.settings.cycleAnchor || today(),firstDay);
    const days = diffDays(weekStart(value,firstDay), anchor);
    if (!Number.isFinite(days)) return types[0];
    const index = ((Math.floor(days / 7) % types.length) + types.length) % types.length;
    return types[index];
  }
  function planForDate(state, value) {
    const firstDay=state.settings && state.settings.weekStartDay != null ? state.settings.weekStartDay : 0;
    const period = periodForDate(state,value), weekType = weekTypeFor(state,value), start = weekStart(value,firstDay);
    let entries = [], source = 'none';
    if (period && weekType) {
      const day = (parseDate(value).getDay() + 1) % 7;
      const weekOverride = period.weekOverrides && period.weekOverrides[start];
      if (Object.prototype.hasOwnProperty.call(period.dayOverrides || {},value)) { entries = period.dayOverrides[value]; source = 'day'; }
      else if (weekOverride && Object.prototype.hasOwnProperty.call(weekOverride.days || {},day)) { entries = weekOverride.days[day]; source = 'week'; }
      else { entries = period.plans[weekType.id] && period.plans[weekType.id][day] || []; source = 'period'; }
    }
    return {periodId:period ? period.id : '',periodName:period ? period.name : '',weekTypeId:weekType ? weekType.id : '',weekTypeName:weekType ? weekType.name : '',weekType,exercises:clone(entries),source,weekStart:start};
  }
  function rebaseWeekStart(state, newDay) {
    if(!Number.isInteger(newDay)||newDay<0||newDay>6)throw new RangeError('روز شروع هفته معتبر نیست.');
    const next=clone(state),oldDay=next.settings.weekStartDay==null?0:next.settings.weekStartDay;
    if(oldDay===newDay){next.settings.weekStartDay=newDay;return next;}
    // Resolve old dates before changing the calendar alignment. Existing exact
    // date plans and type exceptions always retain priority over weekly ones.
    for(const period of next.periods||[]){
      period.dayOverrides??={};period.dayWeekTypes??={};
      for(const start of Object.keys(period.weekOverrides||{}))for(let offset=0;offset<7;offset++){
        const date=addDays(start,offset);
        if(date<period.startDate||period.endDate&&date>period.endDate)continue;
        const resolved=planForDate(next,date);
        if(!Object.prototype.hasOwnProperty.call(period.dayOverrides,date))period.dayOverrides[date]=clone(resolved.exercises);
        if(!Object.prototype.hasOwnProperty.call(period.dayWeekTypes,date)&&resolved.weekTypeId)period.dayWeekTypes[date]=resolved.weekTypeId;
      }
      period.weekOverrides={};
      period.cycleAnchor=weekStart(period.cycleAnchor,newDay);
    }
    next.settings.cycleAnchor=weekStart(next.settings.cycleAnchor,newDay);
    next.settings.weekStartDay=newDay;
    return next;
  }

  function initialState() {
    const exercises = [];
    const setTypes = [
      {id:'normal',name:'ست اصلی',description:'ست معمولی با ثبت وزنه و تکرار'},
      {id:'warmup',name:'گرم‌کردنی',description:'در آمار ست‌های اصلی و حجم اصلی محاسبه نمی‌شود'},
      {id:'light',name:'سبک و کنترل‌شده',description:'تمرکز بر دامنه کامل حرکت و انقباض با کیفیت'},
      {id:'rest-pause',name:'رست‌پاز ۱۵ ثانیه',description:'۶ تا ۱۰ تکرار + ۱۵ ثانیه استراحت + حداکثر تکرار'},
      {id:'drop',name:'دراپ‌ست ۳۰٪',description:'۶ تا ۱۰ تکرار، ۳۰٪ کاهش وزنه، تکرار تا ناتوانی با ۴ ثانیه فاز منفی'},
      {id:'cluster',name:'کلاستر',description:'۴ بخش تک یا دو تکراری با ۱۵ ثانیه استراحت'},
      {id:'rest20',name:'رست‌پاز ۲۰ ثانیه',description:'۶ تا ۱۰ تکرار، ۲۰ ثانیه استراحت، ادامه تا یک تکرار مانده به ناتوانی'},
      {id:'superset',name:'سوپرست',description:'دو حرکت پشت سر هم؛ هر حرکت را جداگانه ثبت کنید'}
    ];
    const weekTypes = [
      {id:'A',name:'A',instructions:'تعداد و انتخاب حرکات بستگی به حال بدنی شما در آن روز دارد. برای هر حرکت ۲ ست اصلی و هرچقدر لازم است ست گرم‌کردنی بزنید.',set1:'رسیدن به ناتوانی عضلانی در بازه ۶ تا ۱۰ تکرار.',set2:'ست سبک‌تر؛ تمرکز روی دامنه کامل حرکت و انقباض با کیفیت.'},
      {id:'B',name:'B',instructions:'برای هر حرکت ۲ ست اصلی؛ تکنیک‌های زیر فقط برای ست دوم هستند. یکی از چهار روش را انتخاب کنید. ست‌های گرم‌کردنی به تعداد لازم.',set1:'رسیدن به ناتوانی عضلانی در بازه ۶ تا ۱۰ تکرار.',set2:'۱. ۶ تا ۱۰ تکرار + ۱۵ ثانیه استراحت + دوباره حداکثر تکرار\n۲. ۶ تا ۱۰ تکرار، سپس ۳۰ درصد کاهش وزنه و تکرار تا ناتوانی با ۴ ثانیه فاز منفی\n۳. کلاستر: ۴ بار تک یا دو تکرار با ۱۵ ثانیه استراحت\n۴. ۶ تا ۱۰ تکرار، سپس ۲۰ ثانیه استراحت و ادامه تا جایی که فقط یک تکرار باقی بماند'}
    ];
    const plans = {};
    for (const week of weekTypes) {
      plans[week.id] = {};
      for (let day = 0; day < 7; day++) plans[week.id][day] = [];
    }
    return migrate({
      version:1, exercises, setTypes, weekTypes, plans, sessions:[],
      measurementTypes:[
        {id:'weight',name:'وزن بدن',unit:'kg'},
        {id:'chest',name:'دور سینه',unit:'cm'},
        {id:'waist',name:'دور کمر',unit:'cm'},
        {id:'hip',name:'دور باسن',unit:'cm'},
        {id:'arm-right',name:'دور بازوی راست',unit:'cm'},
        {id:'arm-left',name:'دور بازوی چپ',unit:'cm'},
        {id:'thigh',name:'دور ران',unit:'cm'},
        {id:'calf',name:'دور ساق',unit:'cm'},
        {id:'neck',name:'دور گردن',unit:'cm'}
      ], measurements:[],
      profile:{name:'',height:'',gender:'',goal:''},
      settings:{cycleAnchor:weekStart(today()),reminderDays:14,demo:false}
    });
  }
  function blankStats() { return {sessions:0,sets:0,completedSets:0,skippedSets:0,warmupSets:0,warmupSkippedSets:0,reps:0,volume:0,maxWeight:0,completedExercises:0,skippedExercises:0}; }
  function numeric(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
  function warmupSet(set){return set.warmup||set.typeId==='warmup';}
  function performedExercise(exercise) {
    return exercise.status!=='skipped'&&(exercise.sets||[]).some(set=>set.status!=='skipped'&&!warmupSet(set)&&[set,...(set.segments||[])].some(part=>numeric(part.reps)>0));
  }
  function skippedExercise(exercise){
    if(exercise.status==='skipped')return true;
    const sets=exercise.sets||[],main=sets.filter(set=>!warmupSet(set)),relevant=main.length?main:sets;
    return relevant.length>0&&relevant.every(set=>set.status==='skipped');
  }
  function sessionStats(session) {
    const result = blankStats();
    result.sessions = 1;
    for (const exercise of (session.exercises || [])) {
      if(skippedExercise(exercise))result.skippedExercises++;
      if(performedExercise(exercise))result.completedExercises++;
      for (const set of (exercise.sets || [])) {
        if(exercise.status==='skipped'||set.status==='skipped'){if(warmupSet(set))result.warmupSkippedSets++;else result.skippedSets++;continue;}
        if (warmupSet(set)) { result.warmupSets++; continue; }
        const parts = [set, ...(set.segments || [])];
        if(!parts.some(part=>numeric(part.reps)>0))continue;
        result.sets++;result.completedSets++;
        for (const part of parts) {
          const reps = numeric(part.reps), weight = numeric(part.weight);
          if(!reps)continue;
          result.reps += reps;
          result.volume += reps * weight;
          result.maxWeight = Math.max(result.maxWeight, weight);
        }
      }
    }
    result.volume = Math.round(result.volume * 1000) / 1000;
    return result;
  }
  function mergeStats(target, source) {
    for (const key of ['sessions','sets','completedSets','skippedSets','warmupSets','warmupSkippedSets','reps','volume','completedExercises','skippedExercises']) target[key] += source[key];
    target.maxWeight = Math.max(target.maxWeight, source.maxWeight);
    target.volume = Math.round(target.volume * 1000) / 1000;
    return target;
  }
  function stats(sessions) {
    return (sessions || []).reduce((result, session) => mergeStats(result, sessionStats(session)), blankStats());
  }
  function aggregate(sessions, period, calendar='persian', firstDay=0) {
    const selectedCalendar=calendars.has(calendar)?calendar:'persian';
    const formatter=new Intl.DateTimeFormat('fa-IR',{calendar:selectedCalendar,...(period==='month'?{month:'long',year:'numeric'}:{month:'short',day:'numeric',year:'numeric'})});
    const blankBucket=key=>({key,label:formatter.format(parseDate(key)),date:key,...blankStats(),maxWeight:null,hasData:false});
    const map = new Map();
    for (const session of (sessions || [])) {
      if (!parseDate(session.date)) continue;
      const key = period === 'day' ? session.date : period === 'month' ? calendarMonthStart(session.date,selectedCalendar) : weekStart(session.date,firstDay);
      if (!map.has(key)) {
        map.set(key, {...blankBucket(key),maxWeight:0,hasData:true});
      }
      mergeStats(map.get(key), sessionStats(session));
    }
    for(const bucket of map.values())if(!bucket.completedExercises)bucket.maxWeight=null;
    const actual=[...map.values()].sort((a,b)=>a.key.localeCompare(b.key));
    if(!actual.length)return actual;
    const filled=[],last=actual[actual.length-1].key;
    let cursor=actual[0].key;
    while(cursor<=last){
      if(filled.length>=600){
        // Preserve every actual bucket for long spans; only synthetic gaps are
        // omitted. UI diagnostics can disclose this without hiding real logs.
        actual.gapsOmitted=true;
        return actual;
      }
      filled.push(map.get(cursor)||blankBucket(cursor));
      if(cursor===last)break;
      const next=period==='day'?addDays(cursor,1):period==='month'?calendarMonthStart(addDays(cursor,32),selectedCalendar):addDays(cursor,7);
      if(!next||next<=cursor){actual.gapsOmitted=true;return actual;}
      cursor=next;
    }
    return filled;
  }
  function exerciseSeries(sessions, exerciseId) {
    const map = new Map();
    for (const session of (sessions || [])) {
      if (!parseDate(session.date)) continue;
      const exercises = (session.exercises || []).filter(exercise => exercise.exerciseId === exerciseId);
      if (!exercises.length) continue;
      if (!map.has(session.date)) map.set(session.date, {key:session.date,date:session.date,label:new Intl.DateTimeFormat('fa-IR',{month:'short',day:'numeric'}).format(parseDate(session.date)),...blankStats(),completedSessions:0,skippedSessions:0});
      const point=map.get(session.date),performed=exercises.some(performedExercise);
      mergeStats(point, sessionStats({...session, exercises}));
      if(performed)point.completedSessions++;else if(exercises.some(skippedExercise))point.skippedSessions++;
    }
    return [...map.values()].sort((a,b) => a.date.localeCompare(b.date)).map(point=>({...point,maxWeight:point.completedSessions?point.maxWeight:null}));
  }
  function exerciseReport(sessions, exerciseId) {
    const report={scheduledSessions:0,completedSessions:0,skippedSessions:0,sets:0,completedSets:0,skippedSets:0,warmupSets:0,warmupSkippedSets:0,reps:0,volume:0,maxWeight:null,firstDate:null,lastDate:null,firstWeight:null,lastWeight:null,weightChange:null};
    const performed=[];
    for(const session of [...(sessions||[])].filter(session=>parseDate(session.date)).sort((a,b)=>a.date.localeCompare(b.date))){
      const exercises=(session.exercises||[]).filter(exercise=>exercise.exerciseId===exerciseId);
      if(!exercises.length)continue;
      report.scheduledSessions++;
      const total=sessionStats({...session,exercises});
      for(const key of ['sets','completedSets','skippedSets','warmupSets','warmupSkippedSets','reps','volume'])report[key]+=total[key];
      if(!exercises.some(performedExercise)){
        if(exercises.some(skippedExercise))report.skippedSessions++;
        continue;
      }
      report.completedSessions++;
      report.maxWeight=report.maxWeight==null?total.maxWeight:Math.max(report.maxWeight,total.maxWeight);
      performed.push({date:session.date,weight:total.maxWeight});
    }
    if(performed.length){report.firstDate=performed[0].date;report.lastDate=performed[performed.length-1].date;report.firstWeight=performed[0].weight;report.lastWeight=performed[performed.length-1].weight;if(performed.length>1)report.weightChange=Math.round((report.lastWeight-report.firstWeight)*1000)/1000;}
    report.volume=Math.round(report.volume*1000)/1000;
    return report;
  }
  function percentChange(current, previous) {
    const a = Number(current), b = Number(previous);
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a-b) / Math.abs(b) * 100 : null;
  }

  function validateLegacy(data) {
    const invalid = error => ({ok:false,error});
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const text = (value, max=10000) => typeof value === 'string' && value.length <= max;
    const id = value => text(value,120) && /^[a-zA-Z0-9_-]+$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
    const number = (value, max=1000000) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
    const optionalNumber = (value, max=1000000) => value === '' || number(value,max);
    const date = value => !!parseDate(value);
    const array = value => Array.isArray(value) && value.length <= 50000;
    const unique = list => new Set(list.map(item => item.id)).size === list.length;
    const has = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
    const shortTextList = value => Array.isArray(value) && value.length <= 30 && value.every(item=>text(item,200));
    const mediaUrl=value=>text(value,2*1024*1024)&&(value===''||/^https:\/\/[^\s<>"'\\]+$/.test(value)||/^data:image\/(?:gif|png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value));
    if (!object(data) || data.version !== 1) return invalid('نسخه یا ساختار فایل پشتیبان معتبر نیست.');
    if (has(data,'catalogRevision') && (!Number.isInteger(data.catalogRevision) || !number(data.catalogRevision,10000))) return invalid('نسخهٔ بانک حرکات معتبر نیست.');
    for (const key of ['exercises','setTypes','weekTypes','sessions','measurementTypes','measurements']) if (!array(data[key]) || !data[key].every(object) || !unique(data[key])) return invalid('فهرست «' + key + '» معتبر نیست یا شناسه تکراری دارد.');
    if (!data.weekTypes.length || !data.setTypes.length || !data.measurementTypes.some(t=>t.id==='weight' && t.unit==='kg')) return invalid('حداقل یک نوع هفته، نوع ست و شاخص وزن با واحد کیلوگرم لازم است.');
    for (const ex of data.exercises) {
      if (!id(ex.id) || !text(ex.name,200) || !ex.name.trim() || !text(ex.muscle,200) || !text(ex.equipment,200) || !text(ex.notes)) return invalid('اطلاعات حرکات معتبر نیست.');
      if (has(ex,'englishName') && !text(ex.englishName,200) || has(ex,'sourceId') && !text(ex.sourceId,200) || has(ex,'favorite') && typeof ex.favorite !== 'boolean') return invalid('نام انگلیسی، منبع یا علاقه‌مندی حرکت معتبر نیست.');
      for (const key of ['aliases','primaryMuscles','secondaryMuscles']) if (has(ex,key) && !shortTextList(ex[key])) return invalid('نام‌های جایگزین یا دسته‌بندی عضلات حرکت معتبر نیست.');
      for (const key of ['category','level','mechanic','force','source']) if (has(ex,key) && !text(ex[key],100)) return invalid('مشخصات دسته‌بندی حرکت معتبر نیست.');
      if(has(ex,'mediaUrl')&&!mediaUrl(ex.mediaUrl)||has(ex,'mediaCaption')&&!text(ex.mediaCaption,1000)||has(ex,'mediaCredit')&&!text(ex.mediaCredit,1000))return invalid('رسانه یا توضیح اجرای حرکت معتبر نیست.');
    }
    for (const type of data.setTypes) {
      if (!id(type.id) || !text(type.name,200) || !type.name.trim() || !text(type.description)) return invalid('اطلاعات نوع ست معتبر نیست.');
      if(has(type,'partCount')&&(!Number.isInteger(type.partCount)||type.partCount<1||type.partCount>20)||has(type,'kind')&&!['working','warmup'].includes(type.kind))return invalid('تعداد بخش‌ها یا نوع محاسبهٔ ست معتبر نیست.');
    }
    for (const week of data.weekTypes) if (!id(week.id) || !text(week.name,200) || !week.name.trim() || !text(week.instructions) || !text(week.set1) || !text(week.set2)) return invalid('اطلاعات نوع هفته معتبر نیست.');
    const exerciseIds = new Set(data.exercises.map(x=>x.id));
    const setIds = new Set(data.setTypes.map(x=>x.id));
    for(const week of data.weekTypes)for(const key of ['set1TypeId','set2TypeId'])if(has(week,key)&&!setIds.has(week[key]))return invalid('نوع ست اول یا دوم هفته معتبر نیست.');
    const weekIds = new Set(data.weekTypes.map(x=>x.id));
    const measureIds = new Set(data.measurementTypes.map(x=>x.id));
    if (!object(data.plans)) return invalid('برنامه هفتگی معتبر نیست.');
    for (const [weekId, days] of Object.entries(data.plans)) {
      if (!weekIds.has(weekId) || !object(days)) return invalid('نوع هفته در برنامه معتبر نیست.');
      for (const [day, entries] of Object.entries(days)) {
        if (!/^[0-6]$/.test(day) || !array(entries) || !entries.every(object) || !unique(entries)) return invalid('روزهای برنامه معتبر نیست.');
        for (const item of entries) if (!id(item.id) || !exerciseIds.has(item.exerciseId) || !Number.isInteger(item.targetSets) || !number(item.targetSets,100) || item.targetSets<1 || !Number.isInteger(item.repMin) || !Number.isInteger(item.repMax) || !number(item.repMin,10000) || !number(item.repMax,10000) || item.repMax<item.repMin || !number(item.rest,3600) || !text(item.notes)) return invalid('جزئیات برنامه معتبر نیست.');
      }
    }
    for (const session of data.sessions) {
      if (!id(session.id) || !date(session.date) || !id(session.weekTypeId) || !Number.isInteger(session.dayIndex) || session.dayIndex<0 || session.dayIndex>6 || !text(session.notes) || !number(session.energy,5) || typeof session.completed !== 'boolean' || !array(session.exercises) || !session.exercises.every(object) || !unique(session.exercises)) return invalid('اطلاعات جلسه تمرین معتبر نیست.');
      for (const ex of session.exercises) {
        if (!id(ex.id) || !id(ex.exerciseId) || !array(ex.sets) || !ex.sets.every(object) || !unique(ex.sets)) return invalid('حرکات یک جلسه معتبر نیست.');
        if(has(ex,'status')&&!['completed','skipped'].includes(ex.status)||has(ex,'planned')&&typeof ex.planned!=='boolean')return invalid('وضعیت اجرای حرکت معتبر نیست.');
        for (const set of ex.sets) {
          if (!id(set.id) || !id(set.typeId) || typeof set.warmup !== 'boolean' || !number(set.weight,10000) || !Number.isInteger(set.reps) || !number(set.reps,10000) || !optionalNumber(set.rir,100) || !text(String(set.tempo),100) || !text(set.notes) || !array(set.segments) || !set.segments.every(part=>object(part)&&number(part.weight,10000)&&Number.isInteger(part.reps)&&number(part.reps,10000))) return invalid('جزئیات ست یا بخش‌های آن معتبر نیست.');
          if(has(set,'status')&&!['completed','skipped'].includes(set.status)||has(set,'typeName')&&!text(set.typeName,200))return invalid('وضعیت یا نام ذخیره‌شدهٔ ست معتبر نیست.');
        }
      }
    }
    for (const type of data.measurementTypes) if (!id(type.id) || !text(type.name,200) || !type.name.trim() || !['cm','kg'].includes(type.unit)) return invalid('شاخص‌های بدن معتبر نیستند.');
    for (const entry of data.measurements) {
      if (!id(entry.id) || !date(entry.date) || !object(entry.values) || !text(entry.notes)) return invalid('اندازه‌گیری بدن معتبر نیست.');
      for (const [key,value] of Object.entries(entry.values)) if (!measureIds.has(key) || !number(value,10000) || value===0) return invalid('مقدار اندازه‌گیری بدن معتبر نیست.');
    }
    if (!object(data.profile) || !text(data.profile.name,200) || !optionalNumber(data.profile.height,300) || !text(data.profile.gender,100) || !text(data.profile.goal,10000)) return invalid('اطلاعات پروفایل معتبر نیست.');
    if (!object(data.settings) || !date(data.settings.cycleAnchor) || !Number.isInteger(data.settings.reminderDays) || !number(data.settings.reminderDays,3650) || data.settings.reminderDays<1 || typeof data.settings.demo !== 'boolean') return invalid('تنظیمات فایل معتبر نیست.');
    if (has(data.settings,'language') && !['fa','en','tr','ar'].includes(data.settings.language) || has(data.settings,'calendar') && !calendars.has(data.settings.calendar)) return invalid('زبان یا تقویم انتخابی معتبر نیست.');
    if(has(data.settings,'theme')&&!['light','dark','system'].includes(data.settings.theme))return invalid('تم انتخابی معتبر نیست.');
    const firstDay=has(data.settings,'weekStartDay')?data.settings.weekStartDay:0;
    if(!Number.isInteger(firstDay)||firstDay<0||firstDay>6||weekStart(data.settings.cycleAnchor,firstDay)!==data.settings.cycleAnchor)return invalid('روز شروع هفته یا مبدأ چرخه معتبر نیست.');
    return {ok:true,error:''};
  }
  function validateImport(data) {
    if (!data || typeof data !== 'object') return {ok:false,error:'ساختار فایل معتبر نیست.'};
    if (data.version === 1) return validateLegacy(data);
    if (data.version !== 2) return {ok:false,error:'نسخهٔ فایل پشتیبان معتبر نیست.'};
    const base = validateLegacy({...data,version:1});
    if (!base.ok) return base;
    const invalid = error => ({ok:false,error});
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const text = (value,max=10000) => typeof value === 'string' && value.length <= max;
    const id = value => text(value,120) && /^[a-zA-Z0-9_-]+$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
    const date = value => !!parseDate(value);
    const array = value => Array.isArray(value) && value.length <= 50000;
    const has = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
    const firstDay=data.settings.weekStartDay==null?0:data.settings.weekStartDay;
    if (!Array.isArray(data.periods) || data.periods.length > 500 || !data.periods.every(object) || new Set(data.periods.map(x=>x.id)).size !== data.periods.length) return invalid('فهرست دوره‌ها معتبر نیست.');
    const ordered = [...data.periods].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
    for (let i=0;i<ordered.length;i++) {
      const period = ordered[i];
      if (!id(period.id) || !text(period.name,200) || !period.name.trim() || !date(period.startDate) || !(period.endDate === '' || date(period.endDate) && period.endDate >= period.startDate) || !date(period.cycleAnchor) || weekStart(period.cycleAnchor,firstDay) !== period.cycleAnchor || !text(period.notes)) return invalid('نام، بازه یا مبدأ چرخهٔ یک دوره معتبر نیست.');
      if (i && (!ordered[i-1].endDate || period.startDate <= ordered[i-1].endDate)) return invalid('بازهٔ دوره‌ها نباید با هم هم‌پوشانی داشته باشند.');
      const definitions = validateLegacy({...data,version:1,weekTypes:period.weekTypes,plans:period.plans,sessions:[]});
      if (!definitions.ok) return invalid('برنامهٔ دورهٔ «'+period.name+'»: '+definitions.error);
      const weekIds = new Set(period.weekTypes.map(x=>x.id));
      if (!object(period.weekOverrides) || !object(period.dayOverrides)) return invalid('تغییرهای مخصوص روز یا هفته معتبر نیست.');
      if(has(period,'dayWeekTypes')){
        if(!object(period.dayWeekTypes)||Object.keys(period.dayWeekTypes).length>50000)return invalid('نوع هفتهٔ روزهای خاص معتبر نیست.');
        for(const [day,typeId]of Object.entries(period.dayWeekTypes))if(!date(day)||day<period.startDate||period.endDate&&day>period.endDate||!weekIds.has(typeId))return invalid('نوع هفته یا تاریخ روز خاص معتبر نیست.');
      }
      if (Object.keys(period.weekOverrides).length > 50000 || Object.keys(period.dayOverrides).length > 50000) return invalid('تعداد تغییرهای برنامه بیش از حد است.');
      for (const [start,override] of Object.entries(period.weekOverrides)) {
        if (!date(start) || weekStart(start,firstDay) !== start || !object(override) || !weekIds.has(override.weekTypeId) || !object(override.days)) return invalid('تغییر یک هفته معتبر نیست.');
        if (addDays(start,6) < period.startDate || period.endDate && start > period.endDate) return invalid('هفتهٔ تغییریافته باید با بازهٔ دوره مشترک باشد.');
        const p = validateLegacy({...data,version:1,weekTypes:period.weekTypes,plans:{[override.weekTypeId]:override.days},sessions:[]});
        if (!p.ok) return invalid('برنامهٔ هفتهٔ تغییریافته معتبر نیست: '+p.error);
      }
      for (const [day,entries] of Object.entries(period.dayOverrides)) {
        if (!date(day) || day < period.startDate || period.endDate && day > period.endDate || !array(entries)) return invalid('تاریخ یا برنامهٔ روز تغییریافته معتبر نیست.');
        const p = validateLegacy({...data,version:1,weekTypes:period.weekTypes,plans:{[period.weekTypes[0].id]:{0:entries}},sessions:[]});
        if (!p.ok) return invalid('برنامهٔ روز تغییریافته معتبر نیست: '+p.error);
      }
    }
    for (const session of data.sessions) {
      if (has(session,'periodId') && session.periodId !== '' && !id(session.periodId) || has(session,'periodName') && !text(session.periodName,200) || has(session,'weekTypeName') && !text(session.weekTypeName,200) || has(session,'source') && !['day','week','period','none','manual','notebook'].includes(session.source) || has(session,'planSource') && !['day','week','period','none','manual'].includes(session.planSource)) return invalid('اطلاعات دورهٔ جلسه معتبر نیست.');
      if (session.protocolSnapshot != null) {
        const snapshot = session.protocolSnapshot;
        if (!object(snapshot) || !id(snapshot.id) || !text(snapshot.name,200) || !snapshot.name.trim() || !text(snapshot.instructions) || !text(snapshot.set1) || !text(snapshot.set2)) return invalid('نسخهٔ ذخیره‌شدهٔ دستور تمرین معتبر نیست.');
        // A historical snapshot may reference a definition removed later.
        for(const key of ['set1TypeId','set2TypeId'])if(has(snapshot,key)&&!id(snapshot[key]))return invalid('نوع ست در نسخهٔ ذخیره‌شدهٔ دستور تمرین معتبر نیست.');
      }
    }
    return {ok:true,error:''};
  }
  global.FitCore = {uid,today,addDays,diffDays,weekStart,monthStart,toPersianParts,fromPersian,calendarParts,fromCalendar,calendarMonthStart,setProfile,weekTypeSetId,createSet,migrate,periodForDate,contextForDate,weekTypeFor,planForDate,rebaseWeekStart,initialState,sessionStats,stats,aggregate,exerciseSeries,exerciseReport,percentChange,validateImport};
})(typeof window !== 'undefined' ? window : globalThis);
