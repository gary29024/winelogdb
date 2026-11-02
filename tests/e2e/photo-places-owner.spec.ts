import { test,expect } from '@playwright/test';

// Owner controls' Photo places job: started after the place import, refused before it.
test('the owner corrects guessed photo places from Background jobs',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});
 const idle={storage:{state:'complete',objects:0},research:{state:'complete',wines:{processed:2144,total:2144},producers:{processed:5,total:5}},lwin:{state:'complete',processed:2144,total:2144,matched:0,ambiguous:0,unmatched:0,conflict:0},lwinValidation:{state:'complete',processed:0,total:0,verified:0,review:0,reviewItems:[]},lwinAi:{state:'complete',processed:0,total:0,matched:0,deterministic:0,ai:0,review:0}};
 let status:Record<string,unknown>={...idle,places:{state:'not_started',processed:0,total:0,corrected:0,kept:0,unrecorded:0,error:null}},imported=false;
 const starts:string[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/overview')return route.fulfill({json:{members:[],actions:[],settings:null,prices:[],aiCost:{usd:0,searches:0},memberUsage:{month:'2026-10',items:[]},actionPolicies:[],actionAccess:[],storage:[],reviewOperations:[]}});
  if(path==='/api/admin/rollout/status')return route.fulfill({json:status});
  if(path==='/api/admin/rollout/places'){
   starts.push(path);
   if(!imported)return route.fulfill({status:409,json:{error:'Import the photo place list first: run npm run places:import.'}});
   status={...status,places:{state:'running',processed:25,total:2144,corrected:24,kept:1,unrecorded:0,error:null}};
   return route.fulfill({status:202,json:{accepted:true,status}});
  }
  return route.fulfill({json:{items:[],total:0}});
 });
 await page.goto('/admin?section=maintenance');
 const jobs=page.getByRole('region',{name:'Background jobs'});
 await expect(jobs).toContainText('Photo places');
 await expect(jobs).toContainText('Run once, after npm run places:import');
 await jobs.getByRole('button',{name:'Correct photo places from GPS'}).click();
 await expect(page.getByRole('status').filter({hasText:'Import the photo place list first'})).toBeVisible();
 imported=true;
 await jobs.getByRole('button',{name:'Correct photo places from GPS'}).click();
 await expect(page.getByRole('status').filter({hasText:'Photo place correction is running in the background.'})).toBeVisible();
 await expect(jobs).toContainText('25/2144 wines checked · 24 renamed · 1 kept as typed · 0 kept, no scan record');
 await expect(jobs.getByRole('button',{name:'Pause photo places'})).toBeVisible();
 expect(starts).toHaveLength(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await jobs.screenshot({path:info.outputPath('photo-places-owner.png')});
});
