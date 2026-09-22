import { test,expect,type Page } from '@playwright/test';

import { wine } from './fixtures/layoutWine';

async function mockWine(page:Page,structure:Record<string,string|null>|null,role='member',overrides:Record<string,unknown>={}){
 const maturityRequests:string[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/maturity'))maturityRequests.push(path);
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role,status:'active'}}
   :path==='/api/wines/layout-wine'||path==='/api/shared/wines/layout-wine'?{...wine,recognizedRegion:'Original scanned region',recognizedAppellation:'Original scanned appellation',tastingStructure:structure,structure,...overrides}
   :path.endsWith('/research')?{runs:[]}
   :{items:[],holdings:[],total:0};
  await route.fulfill({json:data});
 });
 return maturityRequests;
}

for(const role of ['owner','member'])for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`${role} ${route}: integrates bottle facts and omits empty structure at phone and desktop sizes`,async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const requests=await mockWine(page,{acidity:null,body:null,finish:null},role);
  await page.goto(route);
  await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
  const facts=page.locator('.detail-section').filter({has:page.getByText('Wine details',{exact:true})});
  for(const value of [wine.lwin7,wine.lwin11,wine.elid,wine.referenceSite,'White · Still','Chardonnay 100%','13%']){
   await expect(facts.getByText(value,{exact:true})).toBeVisible();
  }
  await expect(page.getByText('Official reference',{exact:true})).toHaveCount(0);
  await expect(page.getByText('As recorded',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Structure',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Site / parcel',{exact:true})).toHaveCount(0);
  await expect(page.locator('.vintage-check')).toHaveCount(0);
  await page.getByRole('button',{name:'Drinking window',exact:true}).click();
  await expect(page.getByText(wine.deepSearch.drinkingWindow,{exact:true})).toBeVisible();
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>window.scrollTo(0,0));
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   for(const pair of [['Type','Alcohol'],['LWIN7','LWIN11']]){
    const boxes=await Promise.all(pair.map(label=>facts.locator('dl > div').filter({has:page.getByText(label,{exact:true})}).boundingBox()));
    expect(boxes[0]!.y).toBe(boxes[1]!.y);
    expect(boxes[0]!.x+boxes[0]!.width).toBeLessThan(boxes[1]!.x);
   }
   const contained=await page.locator('.wine-identity').evaluate(card=>{
    const bounds=card.getBoundingClientRect();
    return [...card.querySelectorAll('.detail-pills>span')].every(pill=>pill.getBoundingClientRect().right<=bounds.right);
   });
   expect(contained).toBe(true);
   if(width<700){
    const actions=await page.locator('.wine-actions>button,.wine-actions>a').evaluateAll(items=>items.map(item=>({top:item.getBoundingClientRect().top,height:item.getBoundingClientRect().height})));
    expect(new Set(actions.map(action=>action.top)).size).toBe(1);
    expect(actions.every(action=>action.height>=44)).toBe(true);
   }else{
    const region=(await facts.locator('dl > div').filter({has:page.getByText('Region',{exact:true})}).boundingBox())!;
    const appellation=(await facts.locator('dl > div').filter({has:page.getByText('Appellation',{exact:true})}).boundingBox())!;
    expect(region.y).toBe(appellation.y);
    expect(region.x+region.width).toBeLessThan(appellation.x);
   }
   await page.screenshot({path:testInfo.outputPath(`wine-detail-${width}.png`),fullPage:true});
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
 });

 test(`${role} ${route}: shows only structure values supplied by the viewer`,async({page})=>{
  await mockWine(page,{acidity:'high',body:null,finish:'long'},role);
  await page.goto(route);
  const structure=page.locator('.tasting-structure-summary');
  await expect(structure).toBeVisible();
  await expect(structure.locator('dt')).toHaveText(['Acidity','Finish']);
  await expect(structure.locator('dd')).toHaveText(['High','Long']);
 });
 test(`${role} ${route}: conflict labels fit at 320px and rejected identities retain their status`,async({page})=>{
  await page.setViewportSize({width:320,height:844});
  await mockWine(page,null,role,{identityMatchStatus:'conflict'});
  await page.goto(route);
  const facts=page.locator('.detail-wine-facts');
  await expect(facts.getByText('LWIN7 (needs review)',{exact:true})).toBeVisible();
  await expect(facts.locator('.detail-fact-paired')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const fits=await facts.locator('dt,dd').evaluateAll(items=>items.every(item=>item.getBoundingClientRect().right<=innerWidth));
  expect(fits).toBe(true);
  await mockWine(page,null,role,{identityMatchStatus:'manual',lwin7:null,lwin11:null,elid:null,referenceSuggestions:[{field:'producer',label:'Producer',current:'Old',suggested:'Stale'}]});
  await page.reload();
  await expect(facts).toContainText('Kept without LWIN · automatic matching off');
  await expect(page.locator('.lwin-link-editor,.lwin-suggestion-panel')).toHaveCount(0);
 });
}
