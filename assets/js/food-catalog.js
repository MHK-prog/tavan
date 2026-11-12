(function(global){
'use strict';
const {keys,rows}=global.TavanData.foodCatalog;
const source='USDA FoodData Central · SR Legacy 2018',sourceUrl='https://fdc.nal.usda.gov/download-datasets/';
const records=rows.map(([fdcId,name,englishName,category,values,portions,aliases,preferred])=>({id:'usda-'+fdcId,name,englishName,category,aliases,preferred,nutrients:Object.fromEntries(keys.map((key,index)=>[key,values[index]??null])),units:[{id:'g',name:'گرم',grams:1},...portions.map(([id,name,grams,sourceLabel,sourceAmount,sourceGrams])=>({id:'portion-'+id,name,grams,sourceLabel,sourceAmount,sourceGrams}))],source,sourceUrl:'https://fdc.nal.usda.gov/food-details/'+fdcId+'/nutrients'}));
global.FoodCatalog={records,count:records.length,byId:new Map(records.map(food=>[food.id,food])),source,sourceUrl,license:'https://creativecommons.org/publicdomain/zero/1.0/',citation:'USDA Agricultural Research Service. FoodData Central, SR Legacy release April 2018. Downloaded 2026-11-04.',retrieved:'2026-11-04',nutrientBasis:'100 g edible portion',categories:[...new Set(records.map(food=>food.category))],notes:'نام انگلیسی و مقادیر رسمی منبع حفظ شده‌اند. نام‌های فارسی با واژه‌نامهٔ جست‌وجو ارائه می‌شوند؛ برای انتخاب نوع پخته/خام، شرح کامل و وزن واحد را بررسی کن. مقدار ثبت‌نشده با null نگهداری می‌شود.'};
})(typeof window!=='undefined'?window:globalThis);
