import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

async function setup(page:Page,overrides:Record<string,unknown>={}){
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const body=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}:
   ['/api/wines/layout-wine','/api/shared/wines/layout-wine'].includes(path)?{...wine,appellation:'Gevrey-Chambertin',wineName:'Les Cazetiers',classification:'premier_cru',wineStyle:'red',colour:'Red',grapes:['Pinot Noir'],grapeBlend:[],referenceSite:null,referenceParcel:null,lwin7:null,lwin11:null,elid:null,deepSearch:null,...overrides}:
    path.endsWith('/research')?{runs:[]}:{items:[],holdings:[],total:0};
  await route.fulfill({json:body});
 });
 // Exercise the real WebGL renderer and local geography without a live tile
 // service or network-dependent fonts affecting CI or screenshot stability.
 await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
}

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`${route}: opens on demand, explores named boundaries, and restores focus`,async({page},testInfo)=>{
  const requests:string[]=[],errors:string[]=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await setup(page);await page.goto(route);
  const opener=page.getByRole('button',{name:'View village map'});
  await expect(opener).toBeVisible();
  expect(requests.filter(url=>url.includes('/maps/')||url.includes('openfreemap'))).toEqual([]);
  await opener.click();
  const dialog=page.getByRole('dialog',{name:'Gevrey-Chambertin'});
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox',{name:'Explore a vineyard'})).toHaveValue('inao-denom-610');
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Les Cazetiers');
  // Neighbouring crus are named around the wine's own, even without the street map.
  await expect(dialog.locator('.village-map-name',{hasText:'Petits Cazetiers'})).toHaveCSS('visibility','visible');
  await expect(dialog.locator('.village-map-name',{hasText:/^Les Cazetiers$/})).toHaveCSS('visibility','hidden');
  await expect(dialog.getByText('Some street-map details are unavailable.',{exact:false})).toBeVisible();
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   await dialog.getByRole('button',{name:'Village view',exact:true}).click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
   await page.screenshot({path:testInfo.outputPath(`gevrey-map-${width}.png`)});
  }
  await dialog.getByRole('combobox').selectOption('inao-denom-448');
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Chambertin-Clos de Bèze');
  await expect(dialog.locator('.village-map-overlap')).toContainText('may also be labelled Chambertin');
  await dialog.getByRole('button',{name:'Zoom to selection'}).click();
  await dialog.getByRole('button',{name:'Back to this wine'}).click();
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-610');
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  await opener.click();await expect(page.getByRole('dialog').getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Close village map'}).click();await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
 });
}

test('broad Premier Cru context does not claim a specific vineyard',async({page})=>{
 await setup(page,{wineName:'Gevrey-Chambertin Premier Cru'});await page.goto('/wines/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('combobox')).toHaveValue('inao-denom-616');
 await expect(page.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
 await expect(page.locator('.village-map-selected-label')).toHaveCount(0);
 await expect(page.getByRole('dialog').getByRole('link',{name:/^Explore on Burgundy Atlas: Gevrey-Chambertin Premier Cru appellation/})).toBeVisible();
});

test('failed boundary download can be retried without leaving the wine',async({page})=>{
 await setup(page);let available=false;
 await page.route('**/maps/*.geojson',route=>available?route.continue():route.fulfill({status:503,body:'Unavailable'}));
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('alert')).toContainText('The map could not load');
 available=true;
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(page.locator('.village-map-selected-label')).toHaveText('Les Cazetiers');
 await expect(page).toHaveURL(/\/wines\/layout-wine$/);
});

test('conflicting wine identities do not show a map entry point',async({page})=>{
 await setup(page,{identityMatchStatus:'conflict'});await page.goto('/wines/layout-wine');
 await expect(page.getByRole('heading',{name:'Les Cazetiers',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
});

for(const village of [
 {id:'morey-saint-denis',name:'Morey-Saint-Denis',cru:'Les Ruchots',featureId:'inao-denom-946',count:27,catalogue:'moreyVillageMapCatalogue'},
 {id:'chambolle-musigny',name:'Chambolle-Musigny',cru:'Les Amoureuses',featureId:'inao-denom-455',count:28,catalogue:'chambolleVillageMapCatalogue'},
]){
 for(const route of ['/wines/layout-wine','/shared/layout-wine']){
  test(`${village.name} ${route}: loads only its own map and explores shared Bonnes-Mares`,async({page},testInfo)=>{
   const requests:string[]=[],errors:string[]=[];
   page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
   await page.setViewportSize({width:390,height:844});
   await setup(page,{appellation:village.name,wineName:village.cru});await page.goto(route);
   const opener=page.getByRole('button',{name:'View village map'});
   await expect(opener).toBeVisible();
   const mapRequests=()=>requests.filter(url=>url.includes('/maps/')||url.includes('VillageMapCatalogue.json'));
   expect(mapRequests()).toEqual([]);
   await opener.click();
   const dialog=page.getByRole('dialog',{name:village.name,exact:true});
   await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
   const selector=dialog.getByRole('combobox',{name:'Explore a vineyard'});
   await expect(selector).toHaveValue(village.featureId);
   await expect(selector.locator('option')).toHaveCount(village.count);
   await expect(dialog.locator('.village-map-selected-label')).toHaveText(village.cru);
   expect(requests.filter(url=>url.includes('/maps/')).length).toBeGreaterThan(0);
   expect(requests.filter(url=>url.includes('VillageMapCatalogue.json')).length).toBeGreaterThan(0);
   expect(requests.filter(url=>url.includes('/maps/')).every(url=>url.includes(`/maps/${village.id}.`))).toBe(true);
   expect(requests.filter(url=>url.includes('VillageMapCatalogue.json')).every(url=>url.includes(village.catalogue))).toBe(true);
   await selector.selectOption('inao-denom-361');
   await expect(dialog.locator('.village-map-selected-label')).toHaveText('Bonnes-Mares');
   await expect(dialog.locator('.village-map-overlap')).toContainText('full production area is shown on both village maps');
   await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas: Bonnes-Mares/})).toHaveAttribute('href',/\/bonnes-mares$/);
   for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    await dialog.getByRole('button',{name:'Village view',exact:true}).click();
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`${village.id}-${width}.png`)});
   }
   await dialog.getByRole('button',{name:'Back to this wine'}).click();
   await expect(selector).toHaveValue(village.featureId);
   await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
   expect(errors).toEqual([]);
  });
 }
}

test('Bonnes-Mares opens in Chambolle with both producing communes explained',async({page})=>{
 await setup(page,{appellation:'Bonnes-Mares',wineName:'Bonnes-Mares',classification:'grand_cru'});
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Chambolle-Musigny',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-361');
 await expect(dialog.locator('.village-map-overlap')).toContainText('does not identify which side');
});

test('new village broad wines keep a light appellation tint without a single-cru label',async({page})=>{
 for(const fields of [
  {appellation:'Morey-Saint-Denis',wineName:'Morey-Saint-Denis Premier Cru',classification:'premier_cru',id:'inao-denom-949'},
  {appellation:'Chambolle-Musigny',wineName:'Chambolle-Musigny Vieilles Vignes',classification:'village',id:'inao-denom-449'},
  {appellation:'Vosne-Romanée',wineName:'Vosne-Romanée Premier Cru',classification:'premier_cru',id:'inao-denom-1277'},
  {appellation:'Vosne-Romanée',wineName:'Vosne-Romanée Vieilles Vignes',classification:'village',id:'inao-denom-1262'},
 ]){
  const {id,...wineFields}=fields;
  await setup(page,wineFields);await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:fields.appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(id);
  await expect(dialog.locator('.map-swatch-selected')).toHaveClass(/is-area/);
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await expect(dialog.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
  await page.keyboard.press('Escape');
 }
});

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`Vosne ${route}: maps label spellings, Flagey crus and cross-commune boundaries`,async({page},testInfo)=>{
  const requests:string[]=[],errors:string[]=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await setup(page,{appellation:'Vosne-Romanée',wineName:'Les Petits Monts'});await page.goto(route);
  const opener=page.getByRole('button',{name:'View village map'});
  await expect(opener).toBeVisible();
  expect(requests.filter(url=>url.includes('/maps/')||url.includes('VillageMapCatalogue.json'))).toEqual([]);
  await opener.click();
  const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  const selector=dialog.getByRole('combobox',{name:'Explore a vineyard'});
  await expect(selector).toHaveValue('inao-denom-1274');
  await expect(selector.locator('option')).toHaveCount(24);
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Les Petits Monts');
  await expect(dialog.locator('.village-map-context')).toContainText('8 Grand Crus · 14 Premier Cru climats');
  await expect(dialog.locator('.village-map-context')).toContainText('Vosne-Romanée & Flagey-Échezeaux');
  const catalogues=requests.filter(url=>url.includes('VillageMapCatalogue.json'));
  const boundaries=requests.filter(url=>url.includes('/maps/'));
  expect(catalogues.length).toBeGreaterThan(0);expect(boundaries.length).toBeGreaterThan(0);
  expect(catalogues.every(url=>url.includes('vosneVillageMapCatalogue'))).toBe(true);
  expect(boundaries.every(url=>url.includes('/maps/vosne-romanee.'))).toBe(true);
  for(const [id,name] of [['inao-denom-565','Échezeaux'],['inao-denom-645','Grands-Échezeaux']]){
   await selector.selectOption(id);
   await dialog.getByRole('button',{name:'Zoom to selection'}).click();
   await expect(dialog.locator('.village-map-selected-label')).toHaveText(name);
   await expect(dialog.locator('.village-map-overlap')).toContainText('Flagey-Échezeaux');
  }
  await selector.selectOption('inao-denom-1271');
  await expect(dialog.locator('.village-map-overlap')).toContainText('small corner of its official boundary overlaps Échezeaux');
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   await dialog.getByRole('button',{name:'Village view',exact:true}).click();
   expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:testInfo.outputPath(`vosne-map-${width}.png`)});
  }
  await dialog.getByRole('button',{name:'Back to this wine'}).click();
  await expect(selector).toHaveValue('inao-denom-1274');
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
 });
}

for(const grand of [{name:'Échezeaux',id:'inao-denom-565'},{name:'Grands Échezeaux',id:'inao-denom-645'}]){
 test(`${grand.name}: opens its distinct Grand Cru in the Vosne and Flagey map`,async({page})=>{
  await setup(page,{appellation:grand.name,wineName:grand.name,classification:'grand_cru'});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(grand.id);
  await expect(dialog.locator('.village-map-tier')).toHaveText('Grand Cru');
  await expect(dialog.locator('.village-map-overlap')).toContainText('Flagey-Échezeaux');
 });
}

test('a successful street style arriving later preserves the current village and selection',async({page})=>{
 await setup(page,{appellation:'Morey-Saint-Denis',wineName:'Les Ruchots'});
 let release:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve});
 await page.route('https://tiles.openfreemap.org/styles/liberty',async route=>{
  await gate;
  await route.fulfill({json:{version:8,sources:{},layers:[{id:'test-streets',type:'background',paint:{'background-color':'#e4ebdf'}}]}});
 });
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Morey-Saint-Denis',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await dialog.getByRole('combobox').selectOption('inao-denom-361');
 const baseLoaded=page.waitForResponse('https://tiles.openfreemap.org/styles/liberty');
 release();await baseLoaded;
 await expect(dialog.locator('.village-map-selected-label')).toHaveText('Bonnes-Mares');
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-361');
 await dialog.getByRole('button',{name:'Back to this wine'}).click();
 await expect(dialog.locator('.village-map-selected-label')).toHaveText('Les Ruchots');
 await expect(dialog.locator('.village-map-note')).toHaveCount(0);
});

test('a failed village catalogue offers a working reload without downloading boundaries',async({page})=>{
 await setup(page,{appellation:'Morey-Saint-Denis',wineName:'Les Ruchots'});
 let available=false;
 const boundaries:string[]=[];
 page.on('request',request=>{if(request.url().includes('/maps/'))boundaries.push(request.url())});
 await page.route('**/moreyVillageMapCatalogue.json*',route=>available?route.continue():route.fulfill({status:503,body:'Unavailable'}));
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('alert')).toContainText('The village map could not load');
 expect(boundaries).toEqual([]);
 available=true;
 await page.getByRole('button',{name:'Reload page',exact:true}).click();
 await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(page.locator('.village-map-selected-label')).toHaveText('Les Ruchots');
});
