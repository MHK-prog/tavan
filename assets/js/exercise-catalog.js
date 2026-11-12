(function(global){
'use strict';
const REVISION=1,records=global.TavanData.exerciseRecords;
const norm=v=>String(v??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/[يىئ]/g,'ی').replace(/ك/g,'ک').replace(/[أإآ]/g,'ا').replace(/ؤ/g,'و').replace(/ة/g,'ه').replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[\u200c\u200d_\-\/()[\],.]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const compact=v=>norm(v).replace(/\s/g,'');
const clone=x=>JSON.parse(JSON.stringify(x));
const legacy={bench:'Barbell_Bench_Press_-_Medium_Grip',incline:'Incline_Dumbbell_Press',fly:'Butterfly',lat:'Wide-Grip_Lat_Pulldown',row:'Seated_Cable_Rows','one-arm-row':'One-Arm_Dumbbell_Row',squat:'Barbell_Squat','leg-press':'Leg_Press','leg-curl':'Lying_Leg_Curls',calf:'Standing_Calf_Raises','shoulder-press':'Dumbbell_Shoulder_Press',lateral:'Side_Lateral_Raise',curl:'Dumbbell_Bicep_Curl',pushdown:'Triceps_Pushdown',crunch:'Crunches'};
const oldNames={bench:'پرس سینه هالتر',incline:'پرس بالا سینه دمبل',fly:'قفسه سینه دستگاه',lat:'لت از جلو',row:'قایقی نشسته','one-arm-row':'زیربغل دمبل تک دست',squat:'اسکوات','leg-press':'پرس پا','leg-curl':'پشت پا دستگاه',calf:'ساق پا ایستاده','shoulder-press':'پرس سرشانه دمبل',lateral:'نشر جانب',curl:'جلو بازو دمبل',pushdown:'پشت بازو سیم‌کش',crunch:'کرانچ'};
const bySource=new Map(records.map(r=>[r.sourceId,r]));
function install(state){
 if(state.catalogRevision>=REVISION)return state;
 const used=new Set(state.exercises.map(e=>e.id)),matched=new Set();
 for(const e of state.exercises){
  const source=e.sourceId||(legacy[e.id]||null);
  let r=source?bySource.get(source):null;
  if(!r)r=records.find(r=>[r.name,r.englishName,...r.aliases].some(name=>compact(name)===compact(e.name)));
  if(!r)continue;
  matched.add(r.sourceId);
  const previous=clone(e),merged={...clone(r),...previous,id:e.id};
  if(previous.customName===undefined&&previous.name!==oldNames[e.id]&&previous.name!==r.name&&previous.name!==r.englishName)merged.customName=true;
  // Keep user names, groups, equipment and notes. Add searchable source metadata.
  merged.aliases=[...new Set([...(r.aliases||[]),r.name,...(previous.aliases||[])])].filter(x=>x!==merged.name).slice(0,30);
  Object.assign(e,merged);
 }
 for(const r of records){if(matched.has(r.sourceId))continue;let id=r.id;if(used.has(id)){let i=2;while(used.has(id+'-'+i))i++;id+='-'+i;}used.add(id);state.exercises.push({...clone(r),id});}
 state.catalogRevision=REVISION;return state;
}
function muscles(e){return Array.isArray(e.primaryMuscles)&&e.primaryMuscles.length?e.primaryMuscles:(e.muscle?[e.muscle]:[]);}
function secondary(e){return Array.isArray(e.secondaryMuscles)?e.secondaryMuscles:[];}
const regionMap={'شکم':'شکم و مرکزی','پشت ران':'پا و باسن','داخل ران':'پا و باسن','چهارسر ران':'پا و باسن','جلو بازو':'بازو و ساعد','سرشانه':'سرشانه و کول','سینه':'سینه','میان پشت':'پشت و زیربغل','ساق پا':'پا و باسن','باسن':'پا و باسن','فیله کمر':'پشت و زیربغل','زیربغل':'پشت و زیربغل','پشت بازو':'بازو و ساعد','کول':'سرشانه و کول','ساعد':'بازو و ساعد','گردن':'گردن','خارج ران':'پا و باسن','پا':'پا و باسن','پشت':'پشت و زیربغل','بازو':'بازو و ساعد'};
function regions(e){return [...new Set(muscles(e).map(m=>regionMap[m]||m))];}
function text(e){return norm([e.name,e.englishName,e.muscle,e.equipment,e.category,e.level,e.mechanic,e.force,e.notes,...(e.aliases||[]),...muscles(e),...secondary(e),...regions(e),...(global.FitLocale?[e.equipment,e.category,e.level,e.mechanic,...muscles(e),...secondary(e),...regions(e)].filter(Boolean).map(global.FitLocale.t):[])].filter(Boolean).join(' '));}
function filter(list,f={}){const query=norm(f.query),tokens=query.split(' ').filter(Boolean),tight=compact(query);return list.filter(e=>{if(f.region&&!regions(e).includes(f.region))return false;if(f.muscle&&!muscles(e).includes(f.muscle)&&!(f.includeSecondary&&secondary(e).includes(f.muscle)))return false;if(f.equipment&&e.equipment!==f.equipment)return false;if(f.category&&(e.category||'شخصی')!==f.category)return false;if(f.level&&(e.level||'نامشخص')!==f.level)return false;if(f.favorite&&!e.favorite)return false;if(f.custom&&e.source==='free-exercise-db')return false;const hay=text(e);return !query||tokens.every(t=>hay.includes(t))||compact(hay).includes(tight);});}
function rank(e,query){const q=norm(query),tight=compact(q);if(!q)return 0;const names=[e.name,e.englishName].filter(Boolean).map(norm),tokens=q.split(' ');if(names.some(s=>compact(s)===tight))return 0;if(names.some(s=>compact(s).startsWith(tight)))return 1;if(names.some(s=>compact(s).includes(tight)))return 2;if((e.aliases||[]).some(s=>compact(s).includes(tight)))return 3;if(names.some(s=>tokens.every(t=>s.includes(t))))return 4;return 5;}
function sourceUrl(e){return e.source==='free-exercise-db'&&e.sourceId?'https://github.com/yuhonas/free-exercise-db/blob/main/exercises/'+encodeURIComponent(e.sourceId)+'.json':'';}
global.FitCatalog={revision:REVISION,count:records.length,records,install,filter,rank,normalize:norm,compact,muscles,secondary,regions,sourceUrl,source:'https://github.com/yuhonas/free-exercise-db',license:'https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md',retrieved:'۱۴۰۵/۰۸/۱۲'};
})(typeof window!=='undefined'?window:globalThis);
