(function (global) {
  'use strict';
  const MAX_ROWS=20000, MAX_BYTES=2*1024*1024, MAX_ERRORS=20;
  const digits=value=>String(value??'').replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  const norm=value=>digits(value).replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s_()\-]/g,'').toLowerCase();
  const aliases={date:['date','تاریخ','تاریختمرین','التاريخ','تاريخ التمرين','tarih','antrenman tarihi'],exerciseName:['exercise','exercisename','حرکت','نامحرکت','تمرین','التمرين','اسم التمرين','egzersiz','hareket'],weight:['weight','weightkg','وزنه','وزن','وزنهکیلوگرم','وزنکیلوگرم','الوزن','ağırlık','agirlik'],reps:['reps','repetitions','تکرار','تعدادتکرار','التكرارات','عدد التكرارات','tekrar'],setTypeName:['type','settype','نوعست','نوع','نوع المجموعة','set türü','set turu'],warmup:['warmup','گرمکردن','گرمکردنی','گرم','إحماء','احماء','ısınma','isinma'],notes:['notes','note','یادداشت','توضیح','توضیحات','ملاحظات','notlar']};
  const headers=new Map(Object.entries(aliases).flatMap(([key,values])=>values.map(value=>[norm(value),key])));
  function utf8TooLarge(text){let bytes=0;for(const c of text){const x=c.codePointAt(0);bytes+=x<=0x7f?1:x<=0x7ff?2:x<=0xffff?3:4;if(bytes>MAX_BYTES)return true;}return false;}
  function delimiter(text){let quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&(c==='\n'||c==='\r'))break;else if(!quoted&&c==='\t')return '\t';}quoted=false;let line='';for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&(c==='\n'||c==='\r'))break;else if(!quoted)line+=c;}return line.includes('|')?'|':line.includes(';')?';':null;}
  function records(text,sep){const result=[];let cells=[],cell='',quoted=false,afterQuote=false,line=1,startLine=1,syntax='';
    const endCell=()=>{cells.push(cell);cell='';afterQuote=false;};
    const endRow=()=>{endCell();if(cells.some(x=>x.trim()))result.push({line:startLine,cells,syntax});cells=[];syntax='';startLine=line+1;};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else{cell+=c;if(c==='\n')line++;}continue;}
      if(c==='"'&&!cell.trim()&&!afterQuote){cell='';quoted=true;continue;}
      if(c===sep){endCell();continue;}
      if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();line++;if(result.length>MAX_ROWS+1)return {rows:result,tooMany:true};continue;}
      if(afterQuote){if(!/\s/.test(c))syntax='بعد از پایان نقل‌قول، فقط جداکننده یا پایان سطر مجاز است.';}
      else cell+=c;
    }
    if(quoted)syntax='نقل‌قول باز در این سطر بسته نشده است.';
    if(cell||cells.length||syntax){endCell();if(cells.some(x=>x.trim())||syntax)result.push({line:startLine,cells,syntax});}
    return {rows:result,tooMany:result.length>MAX_ROWS+1};
  }
  function numeric(value){let s=digits(value).trim().replace(/٫/g,'.');if(!s)return NaN;
    if(s.includes('٬')){if(!/^\d{1,3}(٬\d{3})+(\.\d+)?$/.test(s))return NaN;s=s.replace(/٬/g,'');}
    if(s.includes(',')||s.includes('،')){if(!/^\d+[,،]\d{1,2}$/.test(s))return NaN;s=s.replace(/[,،]/,'.');}
    return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)?Number(s):NaN;
  }
  function parseDate(value,core,calendar='persian'){const s=digits(value).trim().replace(/[\u200e\u200f]/g,''),m=/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(s);if(!m)return '';
    const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);if(calendar!=='persian'&&typeof core.fromCalendar==='function')return core.fromCalendar(y,mo,d,calendar);if(y>=1300&&y<=1600)return typeof core.fromPersian==='function'?core.fromPersian(y,mo,d):'';
    if(y<1700||y>9999||mo<1||mo>12||d<1||d>31)return '';
    const iso=String(y).padStart(4,'0')+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),check=new Date(iso+'T12:00:00');
    return !Number.isNaN(check.getTime())&&check.getFullYear()===y&&check.getMonth()+1===mo&&check.getDate()===d?iso:'';
  }
  function parseWarmup(value){const s=norm(value);if(['','0','no','false','نه','خیر','خالی','لا','hayır','hayir'].includes(s))return false;if(['1','yes','true','بله','آره','گرم','گرمکردن','گرمکردنی','نعم','evet'].includes(s))return true;return null;}
  function parse(text,core,settings={}){const calendar=settings.calendar||'persian';const rows=[],errors=[];const fail=(line,message)=>{if(errors.length<MAX_ERRORS)errors.push({line,message});};
    if(typeof text!=='string'||!core||typeof core.today!=='function')return {ok:false,rows,errors:[{line:1,message:'متن ورودی یا ابزار تاریخ در دسترس نیست.'}]};
    if(text.length>MAX_BYTES||utf8TooLarge(text))return {ok:false,rows,errors:[{line:1,message:'متن ورودی باید کمتر از ۲ مگابایت باشد.'}]};
    text=text.replace(/^\ufeff/,'');const leading=/^(?:[\t ]*\r?\n)+/.exec(text)?.[0]||'',lineOffset=(leading.match(/\n/g)||[]).length;text=text.slice(leading.length);
    if(!text.trim())return {ok:false,rows,errors:[{line:1,message:'ابتدا سطرهای تمرین را وارد کن.'}]};
    const sep=delimiter(text);if(!sep)return {ok:false,rows,errors:[{line:1,message:'ستون‌ها را با Tab، خط عمودی | یا نقطه‌ویرگول ; جدا کن.'}]};
    const parsed=records(text,sep);if(parsed.tooMany)return {ok:false,rows,errors:[{line:MAX_ROWS+1,message:'در هر بار حداکثر ۲۰٬۰۰۰ ست وارد کن.'}]};
    let entries=parsed.rows.map(row=>({...row,line:row.line+lineOffset})),mapping=['date','exerciseName','weight','reps','setTypeName','warmup','notes'];
    if(entries.length&&entries[0].cells.some(x=>headers.get(norm(x))==='date')&&!entries[0].cells.some(x=>parseDate(x,core,calendar))){
      const h=entries.shift();mapping=h.cells.map(x=>headers.get(norm(x)));const names=mapping.filter(Boolean);
      if(h.syntax)fail(h.line,h.syntax);
      if(mapping.some(x=>!x))fail(h.line,'نام یکی از ستون‌های سرستون شناخته نشد.');
      if(new Set(names).size!==names.length)fail(h.line,'سرستون تکراری است.');
      if(['date','exerciseName','weight','reps'].some(key=>!names.includes(key)))fail(h.line,'سرستون باید شامل تاریخ، حرکت، وزنه و تکرار باشد.');
      if(errors.length)return {ok:false,rows,errors};
    }
    if(entries.length>MAX_ROWS)return {ok:false,rows,errors:[{line:MAX_ROWS+1,message:'در هر بار حداکثر ۲۰٬۰۰۰ ست وارد کن.'}]};
    let previousDate='',previousExercise='';const today=core.today();
    for(const record of entries){const {line,cells}=record;if(record.syntax){fail(line,record.syntax);continue;}
      if(cells.length>mapping.length){fail(line,'تعداد ستون‌های این سطر بیشتر از قالب ورودی است.');continue;}
      const d={};mapping.forEach((key,i)=>{d[key]=(cells[i]??'').trim();});const date=d.date?parseDate(d.date,core,calendar):previousDate,exerciseName=d.exerciseName||previousExercise,weight=numeric(d.weight),reps=numeric(d.reps),warmup=parseWarmup(d.warmup),setTypeName=d.setTypeName||'ست اصلی',notes=d.notes||'';
      if(!date){fail(line,'تاریخ معتبر وارد کن؛ مثل ۱۴۰۵/۰۱/۰۱ یا 2026-03-21.');continue;}
      if(date>today){fail(line,'تاریخ تمرین نمی‌تواند بعد از امروز باشد.');continue;}
      if(!exerciseName||exerciseName.length>200){fail(line,'نام حرکت باید بین ۱ و ۲۰۰ نویسه باشد.');continue;}
      if(!Number.isFinite(weight)||weight<0||weight>10000){fail(line,'وزنه باید عددی از صفر تا ۱۰٬۰۰۰ باشد؛ اعشار را با نقطه یا ٫ وارد کن.');continue;}
      if(!Number.isInteger(reps)||reps<1||reps>1000){fail(line,'تکرار باید عدد صحیحی از ۱ تا ۱۰۰۰ باشد.');continue;}
      if(warmup===null){fail(line,'گرم‌کردن را با بله/خیر یا ۱/۰ مشخص کن.');continue;}
      if(setTypeName.length>200||notes.length>10000||/[\0]/.test(exerciseName+setTypeName+notes)){fail(line,'نام نوع ست یا یادداشت بیش از حد بلند یا دارای نویسهٔ نامعتبر است.');continue;}
      rows.push({date,exerciseName,weight,reps,setTypeName,warmup,notes});previousDate=date;previousExercise=exerciseName;
    }
    if(!rows.length&&!errors.length)fail(1,'هیچ ست تمرینی در ورودی پیدا نشد.');
    return {ok:errors.length===0&&rows.length>0,rows,errors};
  }
  global.FitBulk={parse};
})(typeof window!=='undefined'?window:globalThis);
