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
 await expect(page.getByRole('dialog').getByRole('link',{name:/^Explore appellation on Burgundy Atlas/})).toBeVisible();
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
