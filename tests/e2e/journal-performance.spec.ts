import { test,expect } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { wine } from './fixtures/layoutWine';

test('Journal accepts input and keeps cards painted while a search is pending',async({page},info)=>{
 const queries:string[]=[];let release!:()=>void;
 const blocked=new Promise<void>(resolve=>{release=resolve});
 const items=Array.from({length:36},(_,i)=>({...wine,id:`w${i}`,wineName:`Wine ${i}`}));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/me'){await route.fulfill({json:{user:{id:'reader',role:'member',display_name:'Reader',status:'active'}}});return}
  if(url.pathname==='/api/journal'){
   const query=url.searchParams.get('query')??'';queries.push(query);
   if(query)await blocked;
   await route.fulfill({json:{items,total:36,nextOffset:null}}).catch(()=>{});return;
  }
  await route.fulfill({json:{items:[]}});
 });
 try{
  await page.goto('/journal');await expect(page.locator('.journal-card-shell')).toHaveCount(36);
  const before=queries.length;
  const inputMs=await page.getByRole('searchbox',{name:'Search wines'}).evaluate(element=>{
   const input=element as HTMLInputElement,set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
   const started=performance.now();
   for(const text of ['f','fl','flo','flor','flora','floral','floral elegant Burgundy']){set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}))}
   return performance.now()-started;
  });
  expect(queries.length).toBe(before);
  await expect.poll(()=>queries.filter(Boolean).length).toBe(1);
  const search=page.getByRole('searchbox',{name:'Search wines'});
  await search.fill('floral elegant Burgundy fresh');await expect(search).toHaveValue('floral elegant Burgundy fresh');
  await expect(page.locator('.journal-card-shell')).toHaveCount(36);
  expect(inputMs).toBeLessThan(1000); // Broad responsiveness guard, not a latency claim.
  const measurement=JSON.stringify({inputEvents:7,inputMs,requestsBeforeInput:before,settledSearchRequests:queries.filter(Boolean).length});
  mkdirSync('.cache',{recursive:true});writeFileSync('.cache/journal-input-profile.json',measurement);
  await info.attach('journal-input-measurement',{body:measurement,contentType:'application/json'});
 }finally{release()}
});
