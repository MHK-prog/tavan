(function(global){
'use strict';
const C=global.FitCore,N=global.NutritionCore,R=global.ReminderCore;
if(C.extensionsVersion===5)return;
const validate=C.validateImport,migrate=C.migrate,initial=C.initialState;
C.validateImport=function(data){const base=validate(data);if(!base.ok)return base;if(Object.hasOwn(data,'nutrition')){const check=N.validate(data.nutrition);if(!check.ok)return {ok:false,error:'تغذیه: '+check.error};}if(Object.hasOwn(data,'reminders')){const check=R.validate(data.reminders);if(!check.ok)return {ok:false,error:'یادآورها: '+check.error};}return base;};
C.migrate=function(data){const next=migrate(data);next.nutrition=N.migrate(next.nutrition);next.reminders=R.migrate(next.reminders);return next;};
C.initialState=function(){return C.migrate(initial());};
C.extensionsVersion=5;
})(typeof window!=='undefined'?window:globalThis);
