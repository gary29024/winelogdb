import { test,expect,type Locator,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

for(const route of ['/wines/layout-wine','/shared/layout-wine'])for(const [appellation,count,commune] of [
 ['Bourgogne Côte d’Or',40,'Dijon'],
 ['Bourgogne Hautes Côtes de Nuits',19,'Arcenant'],
 ['Bourgogne Hautes Côtes de Beaune',29,'Nolay'],
] as const){
 test(`Regional map ${appellation} ${route}: full overview, commune navigation and broad scope`,async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:900});
  await setup(page,{appellation,wineName:'A named cuvée',classification:null,region:'Burgundy',colour:'White',wineStyle:'white',productType:'Wine',productSubtype:'Still'});
  const downloads:string[]=[];
  page.on('request',request=>{if(request.url().includes('/maps/'))downloads.push(request.url())});
  await page.goto(route);await page.evaluate(()=>document.fonts.ready);
  expect(downloads).toEqual([]);
  await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  const requestsAfterOpen=downloads.length;
  await expect(dialog.getByRole('combobox',{name:'Zoom to a commune'})).toHaveValue('');
  await expect(dialog.getByRole('option')).toHaveCount(count+1);
  await expect(dialog.locator('.village-map-context')).toHaveText(`Regional denomination · ${count} communes`);
  await expect(dialog.locator('.village-map-tier')).toHaveText('Regional denomination');
  await expect(dialog.locator('.village-map-description')).toContainText('no single vineyard is identified');
  await expect(dialog.locator('.village-map-legend')).not.toContainText('Village appellation');
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toHaveCount(0);
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  // Rendered offline commune markers give an independent viewport check. The
  // overview must contain every production anchor, including north and south.
  const positions=()=>dialog.locator('.village-map-commune-name').evaluateAll(elements=>{
   const canvas=elements[0].closest('.village-map-canvas')!.getBoundingClientRect();
   return elements.map(element=>{const b=element.getBoundingClientRect();return {x:b.x+b.width/2-canvas.x,y:b.y+b.height/2-canvas.y,width:canvas.width,height:canvas.height}});
  });
  await expect.poll(async()=>{
   const points=await positions();return points.length===count&&points.every(p=>p.x>=0&&p.x<=p.width&&p.y>=0&&p.y<=p.height);
  }).toBe(true);
  await dialog.getByRole('combobox').selectOption({label:commune});
  await expect.poll(async()=>{const points=await positions();return points.some(p=>p.x<0||p.x>p.width||p.y<0||p.y>p.height)}).toBe(true);
  await expect(dialog.getByRole('heading',{name:appellation,exact:true})).toHaveCount(2);
  await expect(dialog.locator('.village-map-description')).toContainText('Regional production area shown');
  await dialog.getByRole('button',{name:'Region view',exact:true}).click();
  await expect(dialog.getByRole('combobox')).toHaveValue('');
  await expect.poll(async()=>{const points=await positions();return points.every(p=>p.x>=0&&p.x<=p.width&&p.y>=0&&p.y<=p.height)}).toBe(true);
  // React StrictMode may abort/retry the initial request in development.
  // Navigation must neither fetch another map nor restart this download.
  expect([...new Set(downloads)]).toHaveLength(1);
  expect(downloads).toHaveLength(requestsAfterOpen);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('regional-overview-320.png')});
  await page.setViewportSize({width:1280,height:900});
  await dialog.getByRole('button',{name:'Region view',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('regional-overview-desktop.png')});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'View regional map'})).toBeFocused();
 });
}

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

// The hillside's opposite ends must both fit and span a useful part of the
// real rendered map, catching a full-village opening or a single-climat crop.
async function grandCruSpan(dialog:Locator){
 return dialog.evaluate(el=>{
  const canvas=el.querySelector('.village-map-canvas')!.getBoundingClientRect();
  const names=[...el.querySelectorAll('.village-map-name')];
  const centres=['Bougros','Blanchot'].map(name=>{
   const box=names.find(node=>node.textContent===name)!.getBoundingClientRect();
   return {x:(box.left+box.right)/2,y:(box.top+box.bottom)/2};
  });
  const inside=centres.every(p=>p.x>canvas.left&&p.x<canvas.right&&p.y>canvas.top&&p.y<canvas.bottom);
  return inside?Math.abs(centres[1].x-centres[0].x)/canvas.width:0;
 });
}

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`Chablis Grand Cru ${route}: named climats open on the hillside`,async({page},testInfo)=>{
  await setup(page,{appellation:'Chablis Grand Cru',wineName:'Domaine Long-Depaquit Les Preuses',classification:'grand_cru',colour:'White',wineStyle:'white'});
  await page.setViewportSize({width:320,height:900});await page.goto(route);
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Chablis',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-444');
  await expect.poll(()=>grandCruSpan(dialog)).toBeGreaterThan(0.35);
  await expect(dialog.locator('.village-map-name',{hasText:/^Bougros$/})).toHaveCSS('visibility','visible');
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Les Preuses');
  await expect(dialog.locator('.village-map-context')).toContainText('1 Grand Cru · 7 Grand Cru climats');
  await expect(dialog.getByRole('option',{name:/La Moutonne/})).toHaveCount(0);
  await expect(dialog.locator('.village-map-legend')).not.toContainText('Approximate producer outline');
  await expect(dialog.locator('.village-map-overlap')).toContainText('whole official climat');
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Village view',exact:true}).click();
  await expect.poll(()=>grandCruSpan(dialog)).toBeLessThan(0.15);
  await dialog.getByRole('button',{name:'Grand Cru view',exact:true}).click();
  await expect.poll(()=>grandCruSpan(dialog)).toBeGreaterThan(0.35);
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-444');
  await dialog.getByRole('combobox').selectOption('inao-denom-446');
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Vaudésir');
  await dialog.getByRole('button',{name:'Back to this wine'}).click();
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-444');
  await expect.poll(()=>grandCruSpan(dialog)).toBeGreaterThan(0.35);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.locator('.village-map-toolbar').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('chablis-grand-cru-320.png')});
 });
 test(`Chablis Grand Cru ${route}: La Moutonne alone has an approximate producer outline`,async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:900});
  await setup(page,{producer:null,appellation:'Chablis Grand Cru',wineName:'Domaine Long-Depaquit La Moutonne',classification:'grand_cru',colour:'White',wineStyle:'white'});
  await page.goto(route);await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Chablis',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue('location-long-depaquit-la-moutonne');
  await expect.poll(()=>grandCruSpan(dialog)).toBeGreaterThan(0.35);
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('La Moutonne (approx.)');
  await expect(dialog.locator('.village-map-selected-label')).toHaveCSS('border-top-style','dashed');
  await expect(dialog.locator('.village-map-eyebrow')).toHaveText('VINEYARD LOCATION');
  await expect(dialog.getByRole('heading',{name:'La Moutonne',exact:true})).toBeVisible();
  await expect(dialog.locator('.village-map-legend')).toContainText('Approximate producer outline');
  await expect(dialog.locator('.village-map-description')).toContainText('not an official or surveyed parcel boundary');
  await expect(dialog.locator('.village-map-overlap')).toContainText('larger than the stated holding');
  await expect(dialog.getByRole('link',{name:'Producer’s source map'})).toHaveAttribute('href','https://catalogue.albert-bichot.com/QM1NSF');
  await expect(dialog.locator('.village-map-footer')).toContainText('separate from INAO data and its licence');
  await expect(dialog.locator('.village-map-footer')).toBeVisible();
  await expect(dialog.locator('.village-map-context')).toContainText('1 Grand Cru · 7 Grand Cru climats');
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
  expect(await dialog.evaluate(el=>{
   const body=el.querySelector('.village-map-body')!.getBoundingClientRect();
   const sidebar=el.querySelector('.village-map-sidebar')!.getBoundingClientRect();
   const footer=el.querySelector('.village-map-footer')!.getBoundingClientRect();
   return body.bottom>=sidebar.bottom&&footer.top>=body.bottom-1;
  })).toBe(true);
  await page.screenshot({path:testInfo.outputPath('chablis-moutonne-320.png')});
  for(const id of ['inao-denom-446','inao-denom-444','inao-denom-439']){
   await dialog.getByRole('combobox').selectOption(id);
   await expect(dialog.locator('.village-map-eyebrow')).toHaveText('EXPLORING');
   await expect(dialog.locator('.village-map-selected-label')).toHaveCount(id==='inao-denom-439'?0:1);
   await expect(dialog.locator('.village-map-selected-label.is-approximate')).toHaveCount(0);
   await expect(dialog.locator('.village-map-legend')).not.toContainText('Approximate producer outline');
   await dialog.getByRole('button',{name:'Village view',exact:true}).click();
   await dialog.getByRole('button',{name:'Back to this wine'}).click();
   await expect(dialog.getByRole('combobox')).toHaveValue('location-long-depaquit-la-moutonne');
   await expect(dialog.locator('.village-map-selected-label')).toHaveText('La Moutonne (approx.)');
   await expect.poll(()=>grandCruSpan(dialog)).toBeGreaterThan(0.35);
  }
  await dialog.getByRole('button',{name:'Zoom to selection',exact:true}).click();
  await expect(dialog.locator('.village-map-selected-label').first()).toBeInViewport();
  await expect(dialog.locator('.village-map-selected-label').last()).toBeInViewport();
  expect(await dialog.evaluate(el=>{
   const label=el.querySelector('.village-map-selected-label')!.getBoundingClientRect();
   return [...el.querySelectorAll('.village-map-toolbar button')].every(button=>{
    const box=button.getBoundingClientRect();
    return label.right<=box.left||box.right<=label.left||label.bottom<=box.top||box.bottom<=label.top;
   });
  })).toBe(true);
  await dialog.locator('.village-map-toolbar').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('chablis-moutonne-detail-320.png')});
  await page.setViewportSize({width:1280,height:900});
  await dialog.getByRole('button',{name:'Grand Cru view',exact:true}).click();
  await expect.poll(()=>grandCruSpan(dialog)).toBeGreaterThan(0.35);
  await dialog.locator('.village-map-toolbar').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('chablis-grand-cru-overview-1280.png')});
 });
 test(`Chablis Premier Cru ${route}: missing and partial boundaries never locate a wine in an incomplete plot`,async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:900});
  for(const wineName of ['Fourchaume','Mont de Milieu','Vaulorent']){
   await setup(page,{appellation:'Chablis',wineName,colour:'White',wineStyle:'white'});
   await page.goto(route);await page.getByRole('button',{name:'View village map'}).click();
   const dialog=page.getByRole('dialog',{name:'Chablis',exact:true});
   await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
   await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-438');
   await expect(dialog.locator('.village-map-description')).toContainText('no single vineyard');
   await expect(dialog.locator('.village-map-note').filter({hasText:'40 Premier Cru climats'})).toBeVisible();
   await expect(dialog.getByRole('option',{name:'Fourchaume (partial boundary)',exact:true})).toHaveCount(1);
   await dialog.getByRole('combobox').selectOption('inao-denom-414');
   await expect(dialog.locator('.village-map-description')).toContainText('does not show its full extent');
   await expect(dialog.locator('.village-map-overlap').first()).toContainText('omits the Chablis-Poinchy part');
   await dialog.getByRole('combobox').selectOption('inao-denom-420');
   await expect(dialog.locator('.village-map-overlap')).toContainText('omits its Fyé part');
   expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   if(wineName==='Fourchaume')await page.screenshot({path:testInfo.outputPath('chablis-partial-boundary-320.png')});
   await dialog.getByRole('button',{name:'Back to this wine'}).click();
   await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-438');
   await page.keyboard.press('Escape');
  }
 });
}

test('Côte de Beaune-Villages has a local map, four area controls and no invented Atlas link',async({page},testInfo)=>{
 await setup(page,{appellation:'Côte de Beaune-Villages',wineName:'Joseph Drouhin Côte de Beaune-Villages',classification:'village'});
 await page.setViewportSize({width:320,height:900});await page.goto('/shared/layout-wine');
 await expect(page.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Côte de Beaune-Villages',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-552');
 await expect(dialog.locator('.village-map-overlap')).toContainText('16 producing communes');
 await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
 for(const area of ['North','Centre','Montrachet area','South']){
  await dialog.getByRole('button',{name:new RegExp(`^${area}:`)}).click();
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-552');
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 }
 await page.screenshot({path:testInfo.outputPath('cote-de-beaune-villages-south-320.png')});
 await page.keyboard.press('Escape');
 for(const fields of [{colour:'White',wineStyle:'white'},{colour:'Rosé',wineStyle:'rose'},{classification:'premier_cru'}]){
  await setup(page,{appellation:'Côte de Beaune-Villages',wineName:'Côte de Beaune-Villages',classification:'village',...fields});await page.goto('/wines/layout-wine');
  await expect(page.getByRole('heading',{name:'Côte de Beaune-Villages',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
 }
});

test('Santenay and Maranges use producer spellings and explain coincident boundaries',async({page})=>{
 for(const row of [
  {appellation:'Santenay',wineName:'Santenay Premier Cru Passe-Temps',id:'inao-denom-1171'},
  {appellation:'Maranges',wineName:'Domaine Monnot-Roche La Croix aux Moines',id:'inao-denom-803'},
  {appellation:'Maranges',wineName:'Domaine Saint Marc Clos Roussot',id:'inao-denom-804'},
 ]){
  await setup(page,row);await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(row.id);
  if(row.appellation==='Santenay'){
   await expect(dialog.locator('.village-map-context')).toContainText('11 Premier Cru climats');
   await dialog.getByRole('combobox').selectOption('inao-denom-1170');
   await expect(dialog.getByRole('heading',{name:'Les Gravières-Clos de Tavannes',exact:true})).toBeVisible();
   await expect(dialog.locator('.village-map-overlap').first()).toContainText('shares its production boundary with Clos de Tavannes');
   await dialog.getByRole('combobox').selectOption('inao-denom-1164');
   await expect(dialog.locator('.village-map-selected-label')).toHaveText('Clos de Tavannes');
   await dialog.getByRole('button',{name:'Back to this wine'}).click();
   await expect(dialog.getByRole('combobox')).toHaveValue(row.id);
  }
  await page.keyboard.press('Escape');
 }
});

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

for(const village of [
 {id:'fixin',name:'Fixin',cru:'Les Meix Bas',tier:'premier_cru',feature:'inao-denom-2372',count:8,catalogue:'fixinVillageMapCatalogue',explore:'inao-denom-571',label:'Clos de la Perrière'},
 {id:'vougeot',name:'Vougeot',cru:'Le Clos Blanc',tier:'premier_cru',feature:'inao-denom-1280',count:7,catalogue:'vougeotVillageMapCatalogue',explore:'inao-denom-546',label:'Clos de Vougeot'},
 {id:'nuits-saint-georges',name:'Nuits-Saint-Georges',cru:'Clos de la Maréchale',tier:'premier_cru',feature:'inao-denom-989',count:43,catalogue:'nuitsVillageMapCatalogue',explore:'inao-denom-976',label:'Aux Boudots'},
 {id:'marsannay',name:'Marsannay',cru:'Les Longeroies',tier:'village',feature:'inao-denom-806-red-white',count:3,catalogue:'marsannayVillageMapCatalogue',explore:'inao-denom-806-rose',label:'Marsannay Rosé'},
 {id:'cote-de-nuits-villages',name:'Côte de Nuits-Villages',cru:'Le Vaucrain',tier:'village',feature:'inao-denom-557',count:1,catalogue:'coteNuitsVillageMapCatalogue',explore:'inao-denom-557',label:'Côte de Nuits-Villages'},
 {id:'meursault',name:'Meursault',cru:'Perrières',tier:'premier_cru',feature:'inao-denom-858',count:23,catalogue:'meursaultVillageMapCatalogue',explore:'inao-denom-2373',label:'Blagny'},
 {id:'puligny-montrachet',name:'Puligny-Montrachet',cru:'Clavoillon',tier:'premier_cru',feature:'inao-denom-1064',count:25,catalogue:'pulignyVillageMapCatalogue',explore:'inao-denom-927',label:'Montrachet'},
 {id:'chassagne-montrachet',name:'Chassagne-Montrachet',cru:'Morgeot',tier:'premier_cru',feature:'inao-denom-527',count:60,catalogue:'chassagneVillageMapCatalogue',explore:'inao-denom-499',label:'La Chapelle'},
 {id:'saint-aubin',name:'Saint-Aubin',cru:'En Remilly',tier:'premier_cru',feature:'inao-denom-1132',count:34,catalogue:'saintAubinVillageMapCatalogue',explore:'inao-denom-1144',label:'Les Cortons'},
 {id:'blagny',name:'Blagny',cru:'La Pièce sous le Bois',tier:'premier_cru',feature:'inao-denom-356',count:9,catalogue:'blagnyVillageMapCatalogue',explore:'inao-denom-353',label:'Hameau de Blagny'},
 {id:'aloxe-corton',name:'Aloxe-Corton',cru:'Les Chaillots',tier:'premier_cru',feature:'inao-denom-248',count:43,catalogue:'aloxeVillageMapCatalogue',explore:'inao-denom-2357',label:'Corton Les Bressandes'},
 {id:'pernand-vergelesses',name:'Pernand-Vergelesses',cru:'Ile des Vergelesses',tier:'premier_cru',feature:'inao-denom-1020',count:37,catalogue:'pernandVillageMapCatalogue',explore:'inao-denom-476',label:'Charlemagne'},
 {id:'ladoix',name:'Ladoix',cru:'Le Rognet et Corton',tier:'premier_cru',feature:'inao-denom-1988',count:42,catalogue:'ladoixVillageMapCatalogue',explore:'inao-denom-2356',label:'Corton Le Rognet et Corton'},
 {id:'beaune',name:'Beaune',cru:'Le Clos des Mouches',tier:'premier_cru',feature:'inao-denom-325',count:44,catalogue:'beauneVillageMapCatalogue',explore:'inao-denom-349',label:'Sur les Grèves - Clos Saint-Anne'},
 {id:'pommard',name:'Pommard',cru:'Clos des Epeneaux',tier:'premier_cru',feature:'inao-denom-1029',count:30,catalogue:'pommardVillageMapCatalogue',explore:'inao-denom-1051',label:'Les Rugiens Bas'},
 {id:'volnay',name:'Volnay',cru:'Santenots',tier:'premier_cru',feature:'inao-denom-1259',count:31,catalogue:'volnayVillageMapCatalogue',explore:'inao-denom-1237',label:'Clos des Ducs'},
 {id:'savigny-les-beaune',name:'Savigny-lès-Beaune',cru:'Bataillère',tier:'premier_cru',feature:'inao-denom-1180',count:26,catalogue:'savignyVillageMapCatalogue',explore:'inao-denom-1193',label:'Les Vergelesses'},
 {id:'chorey-les-beaune',name:'Chorey-lès-Beaune',cru:'Les Beaumonts',tier:'village',feature:'inao-denom-2049',count:3,catalogue:'choreyVillageMapCatalogue',explore:'inao-denom-543',label:'Chorey-lès-Beaune (white)'},
 {id:'auxey-duresses',name:'Auxey-Duresses',cru:'Clos du Val',tier:'premier_cru',feature:'inao-denom-265',count:13,catalogue:'auxeyVillageMapCatalogue',explore:'inao-denom-266',label:'La Chapelle'},
 {id:'monthelie',name:'Monthélie',cru:'Les Champs Fulliots',tier:'premier_cru',feature:'inao-denom-921',count:17,catalogue:'monthelieVillageMapCatalogue',explore:'inao-denom-1993',label:'Le Clou des Chênes'},
 {id:'saint-romain',name:'Saint-Romain',cru:'Sous Roche',tier:'village',feature:'inao-denom-1157',count:3,catalogue:'saintRomainVillageMapCatalogue',explore:'inao-denom-2048',label:'Saint-Romain (white)'},
 {id:'santenay',name:'Santenay',cru:'Passetemps',tier:'premier_cru',feature:'inao-denom-1171',count:16,catalogue:'santenayVillageMapCatalogue',explore:'inao-denom-1170',label:'Les Gravières-Clos de Tavannes'},
 {id:'maranges',name:'Maranges',cru:'La Fussière',tier:'premier_cru',feature:'inao-denom-800',count:11,catalogue:'marangesVillageMapCatalogue',explore:'inao-denom-799',label:'Clos de la Fussière'},
 {id:'cote-de-beaune',name:'Côte de Beaune',cru:'Joseph Drouhin Côte de Beaune',tier:'village',feature:'inao-denom-551',count:1,catalogue:'coteBeauneVillageMapCatalogue',explore:'inao-denom-551',label:'Côte de Beaune'},
 {id:'cote-de-beaune-villages',name:'Côte de Beaune-Villages',cru:'Joseph Drouhin Côte de Beaune-Villages',tier:'village',feature:'inao-denom-552',count:1,catalogue:'coteBeauneVillagesMapCatalogue',explore:'inao-denom-552',label:'Côte de Beaune-Villages'},
 {id:'bouzeron',name:'Bouzeron',cru:'Bouzeron',tier:'village',colour:'White',feature:'inao-denom-1286',count:1,catalogue:'bouzeronVillageMapCatalogue',explore:'inao-denom-1286',label:'Bouzeron'},
 {id:'rully',name:'Rully',cru:'La Pucelle',tier:'premier_cru',feature:'inao-denom-1097',count:25,catalogue:'rullyVillageMapCatalogue',explore:'inao-denom-1091',label:'Clos Saint-Jacques'},
 {id:'mercurey',name:'Mercurey',cru:'Clos des Myglands',tier:'premier_cru',feature:'inao-denom-818',count:34,catalogue:'mercureyVillageMapCatalogue',explore:'inao-denom-819',label:'Clos du Château de Montaigu'},
 {id:'givry',name:'Givry',cru:'La Plante',tier:'premier_cru',feature:'inao-denom-639',count:39,catalogue:'givryVillageMapCatalogue',explore:'inao-denom-2327',label:'La Matrosse'},
 {id:'montagny',name:'Montagny',cru:'Les Coères',tier:'premier_cru',colour:'White',feature:'inao-denom-886',count:51,catalogue:'montagnyVillageMapCatalogue',explore:'inao-denom-894',label:'Les Paquiers'},
 {id:'pouilly-fuisse',name:'Pouilly-Fuissé',cru:'Vers Cras',tier:'premier_cru',colour:'White',feature:'inao-denom-2876',count:25,catalogue:'pouillyFuisseVillageMapCatalogue',explore:'inao-denom-2866',label:'Aux Quarts'},
 {id:'pouilly-loche',name:'Pouilly-Loché',cru:'Les Mûres',tier:'premier_cru',colour:'White',feature:'inao-denom-2932',count:3,catalogue:'pouillyLocheVillageMapCatalogue',explore:'inao-denom-2931',label:'Pouilly-Loché Premier Cru'},
 {id:'pouilly-vinzelles',name:'Pouilly-Vinzelles',cru:'Les Quarts',tier:'premier_cru',colour:'White',feature:'inao-denom-2930',count:5,catalogue:'pouillyVinzellesVillageMapCatalogue',explore:'inao-denom-2929',label:'Les Longeays'},
 {id:'saint-veran',name:'Saint-Véran',cru:'Les Pommards',tier:'village',colour:'White',feature:'inao-denom-1158',count:1,catalogue:'saintVeranVillageMapCatalogue',explore:'inao-denom-1158',label:'Saint-Véran'},
 {id:'vire-clesse',name:'Viré-Clessé',cru:'Quintaine',tier:'village',colour:'White',feature:'inao-denom-1287',count:2,catalogue:'vireClesseVillageMapCatalogue',explore:'inao-denom-1593',label:'Viré-Clessé (named-climat area)'},
 {id:'chablis',name:'Chablis',cru:'Vaucoupin',tier:'premier_cru',colour:'White',feature:'inao-denom-432',count:20,catalogue:'chablisVillageMapCatalogue',explore:'inao-denom-443',label:'Les Clos'},
 {id:'petit-chablis',name:'Petit Chablis',cru:'Petit Chablis',tier:'village',colour:'White',feature:'inao-denom-1024',count:1,catalogue:'petitChablisVillageMapCatalogue',explore:'inao-denom-1024',label:'Petit Chablis'},
 {id:'irancy',name:'Irancy',cru:'Palotte',tier:'village',feature:'inao-denom-1288',count:1,catalogue:'irancyVillageMapCatalogue',explore:'inao-denom-1288',label:'Irancy'},
 {id:'saint-bris',name:'Saint-Bris',cru:'Saint-Bris',tier:'village',colour:'White',feature:'inao-denom-1597',count:1,catalogue:'saintBrisVillageMapCatalogue',explore:'inao-denom-1597',label:'Saint-Bris'},
 {id:'vezelay',name:'Vézelay',cru:'Vézelay',tier:'village',colour:'White',feature:'inao-denom-2829',count:1,catalogue:'vezelayVillageMapCatalogue',explore:'inao-denom-2829',label:'Vézelay'},
]){
 for(const route of ['/wines/layout-wine','/shared/layout-wine']){
  test(`${village.name} ${route}: opens the correct boundary and keeps its full village context`,async({page},testInfo)=>{
   const requests:string[]=[],errors:string[]=[];
   page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
   await page.setViewportSize({width:390,height:844});
   await setup(page,{appellation:village.name,wineName:village.cru,classification:village.tier,
    ...('colour' in village?{colour:village.colour,wineStyle:'white',grapes:['Chardonnay']}:{}),
    ...(village.id==='bouzeron'?{grapes:['Aligoté']}:{}),
    ...(village.id==='saint-bris'?{grapes:['Sauvignon Blanc']}:{}),
   });await page.goto(route);
   const opener=page.getByRole('button',{name:'View village map'});
   await expect(opener).toBeVisible();
   expect(requests.filter(url=>url.includes('/maps/')||url.includes('VillageMapCatalogue.json'))).toEqual([]);
   await opener.click();
   const dialog=page.getByRole('dialog',{name:village.name,exact:true});
   await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
   const selector=dialog.getByRole('combobox');
   await expect(selector).toHaveValue(village.feature);await expect(selector.locator('option')).toHaveCount(village.count);
   expect(requests.filter(url=>url.includes('/maps/')).every(url=>url.includes(`/maps/${village.id}.`))).toBe(true);
   expect(requests.filter(url=>url.includes('VillageMapCatalogue.json')).every(url=>url.includes(village.catalogue))).toBe(true);
   if(village.tier==='village'){
    await expect(dialog.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
    await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
    await expect(dialog.locator('.village-map-hint')).toContainText('appellation area');
   }else await expect(dialog.locator('.village-map-selected-label')).toHaveText(village.cru);
   await selector.selectOption(village.explore);
   await expect(dialog.getByRole('heading',{name:village.label,exact:true,level:3})).toBeVisible();
   for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    await dialog.getByRole('button',{name:'Village view',exact:true}).click();
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`${village.id}-${width}.png`)});
   }
   if(village.explore!==village.feature){
    await dialog.getByRole('button',{name:'Back to this wine'}).click();await expect(selector).toHaveValue(village.feature);
   }
   await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
   expect(errors).toEqual([]);
  });
 }
}

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`Ferret vineyard location ${route}: historical names preserve bottle classification`,async({page},testInfo)=>{
  const width=route.startsWith('/shared')?320:1280;
  await page.setViewportSize({width,height:900});
  for(const row of [
   {wineName:'Le Clos',vintage:2018,classification:'village'},
   {wineName:'Tête de Cru Le Clos',vintage:2019,classification:null},
   {wineName:'Clos de Jeanne',vintage:2022,classification:'premier_cru'},
  ]){
   await setup(page,{...row,producer:'Domaine Ferret',appellation:'Pouilly-Fuissé',region:'Mâconnais',colour:'White',wineStyle:'white'});
   await page.goto(route);
   const pill=page.locator('.detail-classification');
   if(row.classification)await expect(pill).toHaveText(row.classification==='village'?'Village':'Premier Cru');
   else await expect(pill).toHaveCount(0);
   const wineAtlas=page.getByRole('link',{name:/Explore on Burgundy Atlas/});
   if(row.classification==='village')await expect(wineAtlas).toHaveAttribute('aria-label',/Pouilly-Fuissé appellation/);
   if(!row.classification)await expect(wineAtlas).toHaveCount(0);
   await page.getByRole('button',{name:'View village map'}).click();
   const dialog=page.getByRole('dialog',{name:'Pouilly-Fuissé',exact:true});
   await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
   await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-2873');
   await expect(dialog.locator('.village-map-selected-label')).toHaveText('Les Perrières');
   await expect(dialog.locator('.village-map-eyebrow')).toHaveText('VINEYARD LOCATION');
   await expect(dialog.locator('.village-map-tier')).toHaveText('Current map: Premier Cru');
   await expect(dialog.locator('.village-map-description')).toHaveText('Area containing this wine’s vineyard.');
   await expect(dialog.locator('.village-map-overlap')).toContainText('whole climat, not Ferret’s 0.64 ha parcel');
   await expect(dialog.locator('.village-map-overlap')).toContainText('Pre-2020 bottles were village wines');
   await expect(dialog.getByRole('link',{name:'Producer’s explanation'})).toHaveAttribute('href','https://www.domaine-ferret.com/en/wines/2/tete-de-cru-quot-clos-de-jeanne-quot');
   await expect(dialog.getByLabel('Map legend')).toContainText('Containing climat');
   expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   if(row.vintage===2018)await page.screenshot({path:testInfo.outputPath(`ferret-historical-${width}.png`),fullPage:true});
   await dialog.getByRole('combobox').selectOption('inao-denom-2870');
   await expect(dialog.locator('.village-map-eyebrow')).toHaveText('EXPLORING');
   await expect(dialog.getByRole('link',{name:'Producer’s explanation'})).toHaveCount(0);
   await dialog.getByRole('button',{name:'Back to this wine'}).click();
   await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-2873');
   await expect(dialog.getByRole('link',{name:'Producer’s explanation'})).toBeVisible();
   await page.keyboard.press('Escape');
   if(row.classification)await expect(pill).toHaveText(row.classification==='village'?'Village':'Premier Cru');
   else await expect(pill).toHaveCount(0);
  }
 });
}

test('Ferret vineyard location requires unambiguous producer evidence for Le Clos',async({page})=>{
 for(const row of [
  {producer:null,wineName:'Le Clos',id:'inao-denom-2865'},
  {producer:'Château Fuissé',wineName:'Domaine Ferret Le Clos',id:'inao-denom-2865'},
  {producer:'Domaine Ferret',wineName:'Le Clos et Les Crays',id:'inao-denom-2865'},
  {producer:'Château Fuissé',wineName:'Le Clos',id:'inao-denom-2870'},
  {producer:'Domaine Vincent',wineName:'Le Clos',id:'inao-denom-2870'},
  {producer:'Domaine Vincent Cornin',wineName:'Le Clos',id:'inao-denom-2865'},
  {producer:null,wineName:'Domaine Vincent Cornin Pouilly-Fuissé Le Clos',id:'inao-denom-2865'},
 ]){
  await setup(page,{...row,appellation:'Pouilly-Fuissé',colour:'White',wineStyle:'white'});
  await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(row.id);
  await expect(dialog.getByRole('link',{name:'Producer’s explanation'})).toHaveCount(0);
  await page.keyboard.press('Escape');
 }
});

test('Mâconnais local Premier Cru maps keep village Atlas links separate',async({page})=>{
 for(const row of [
  {appellation:'Pouilly-Loché',wineName:'Les Mûres',named:'inao-denom-2932',broad:'inao-denom-2931'},
  {appellation:'Pouilly-Vinzelles',wineName:'Les Quarts',named:'inao-denom-2930',broad:'inao-denom-2927'},
 ]){
  await setup(page,{...row,colour:'White',wineStyle:'white'});await page.goto('/shared/layout-wine');
  await expect(page.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(row.named);
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
  await dialog.getByRole('combobox').selectOption(row.broad);
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await expect(dialog.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await setup(page,{...row,colour:'White',wineStyle:'white',classification:'village'});await page.goto('/wines/layout-wine');
  await expect(page.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(1);
  await page.getByRole('button',{name:'View village map'}).click();
  await expect(page.getByRole('dialog').locator('.village-map-selected-label')).toHaveCount(0);
  await page.keyboard.press('Escape');
 }
});

test('Pouilly-Fuissé producer subdivisions select their full official climat',async({page})=>{
 for(const row of [
  {wineName:'Domaine Ferret Pouilly-Fuissé Le Clos de Jeanne',id:'inao-denom-2873',label:'Les Perrières',note:'producer subdivisions'},
  {wineName:'Domaine Ferret Tournant de Pouilly',id:'inao-denom-2874',label:'Les Reisses',note:'full Les Reisses'},
  {wineName:'Château des Quarts Aux Quarts Clos des Quarts',id:'inao-denom-2866',label:'Aux Quarts',note:'full climat'},
 ]){
  await setup(page,{appellation:'Pouilly-Fuissé',wineName:row.wineName,colour:'White',wineStyle:'white'});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(row.id);
  await expect(dialog.locator('.village-map-selected-label')).toHaveText(row.label);
  await expect(dialog.locator('.village-map-overlap')).toContainText(row.note);
  await page.keyboard.press('Escape');
 }
});

test('Saint-Véran area controls and Viré-Clessé climat area retain broad scope',async({page},testInfo)=>{
 await setup(page,{appellation:'Saint-Véran',wineName:'Les Pommards',classification:'village',colour:'White',wineStyle:'white'});
 await page.setViewportSize({width:320,height:900});await page.goto('/shared/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 for(const area of ['North','South']){
  await dialog.getByRole('button',{name:new RegExp(`^${area}:`)}).click();
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-1158');
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 }
 await page.screenshot({path:testInfo.outputPath('saint-veran-south-320.png')});
 await page.keyboard.press('Escape');
 await setup(page,{appellation:'Viré-Clessé',wineName:'Quintaine',classification:'village',colour:'White',wineStyle:'white'});await page.goto('/wines/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-1287');
 await dialog.getByRole('combobox').selectOption('inao-denom-1593');
 await expect(dialog.locator('.village-map-overlap')).toContainText('does not identify a particular vineyard');
 await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
 await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Back to this wine'}).click();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-1287');
});

test('Mâconnais white-only maps reject colour and unsupported tier conflicts',async({page})=>{
 for(const row of [
  {appellation:'Pouilly-Fuissé',classification:'premier_cru',colour:'Red'},
  {appellation:'Pouilly-Loché',classification:'premier_cru',colour:'Rosé'},
  {appellation:'Pouilly-Vinzelles',classification:'premier_cru',colour:'Red'},
  {appellation:'Saint-Véran',classification:'premier_cru',colour:'White'},
  {appellation:'Viré-Clessé',classification:'premier_cru',colour:'White'},
 ]){
  await setup(page,{...row,wineName:row.appellation});await page.goto('/wines/layout-wine');
  await expect(page.getByRole('heading',{name:row.appellation,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
 }
});

test('Givry explains missing source geometry while local named plots remain selectable',async({page},testInfo)=>{
 await setup(page,{appellation:'Givry',wineName:'Le Vernoy'});await page.goto('/shared/layout-wine');
 await page.setViewportSize({width:320,height:900});
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Givry',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-644');
 await expect(dialog.getByText(/37 of Givry’s 38/)).toBeVisible();
 await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
 await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas: Givry Premier Cru appellation/})).toBeVisible();
 for(const [id,label] of [['inao-denom-639','La Plante'],['inao-denom-2327','La Matrosse'],['inao-denom-2330','Le Médenchot']]){
  await dialog.getByRole('combobox').selectOption(id);
  await expect(dialog.locator('.village-map-selected-label')).toHaveText(label);
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
 }
 await page.screenshot({path:testInfo.outputPath('givry-local-and-missing-320.png')});
 await dialog.getByRole('combobox').selectOption('inao-denom-628');
 await expect(dialog.locator('.village-map-selected-label')).toHaveText('Clos du Vernoy');
 await expect(dialog.locator('.village-map-overlap')).toContainText('must not be used as a substitute for Le Vernoy');
 await dialog.getByRole('button',{name:'Back to this wine'}).click();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-644');
});

test('white-only Chalonnaise appellations reject incompatible colour and Bouzeron Premier Cru',async({page})=>{
 for(const row of [
  {appellation:'Bouzeron',classification:'village',colour:'Red'},
  {appellation:'Montagny',classification:'premier_cru',colour:'Red'},
  {appellation:'Montagny',classification:'village',colour:'Rosé'},
  {appellation:'Bouzeron',classification:'premier_cru',colour:'White'},
 ]){
  await setup(page,{...row,wineName:row.appellation});await page.goto('/wines/layout-wine');
  await expect(page.getByRole('heading',{name:row.appellation,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
 }
});

test('Marsannay preserves colour scope, including unknown colour, wine style and named rosé',async({page})=>{
 for(const fields of [
  {appellation:'Marsannay',colour:'White',id:'inao-denom-806-red-white'},
  {appellation:'Marsannay',colour:'Rosé',id:'inao-denom-806-rose'},
  {appellation:'Marsannay',colour:null,wineStyle:null,id:'inao-denom-806'},
  {appellation:'Marsannay',colour:null,wineStyle:'rose',id:'inao-denom-806-rose'},
  {appellation:'Marsannay',colour:null,wineStyle:'sparkling',id:'inao-denom-806'},
  {appellation:'Marsannay Rosé',colour:null,wineStyle:null,id:'inao-denom-806-rose'},
 ]){
  const {id,...wineFields}=fields;
  await setup(page,{...wineFields,wineName:'Marsannay',classification:'village'});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Marsannay',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(id);
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await page.keyboard.press('Escape');
 }
});

for(const village of [
 {name:'Meursault',white:844,red:2062,app:204},
 {name:'Puligny-Montrachet',white:2047,red:1061,app:219},
 {name:'Saint-Aubin',white:1125,red:2083,app:227},
 {name:'Ladoix',white:657,red:2059,app:192},
 {name:'Savigny-lès-Beaune',white:1173,red:2081,app:231},
 {name:'Chorey-lès-Beaune',white:543,red:2049,app:159},
 {name:'Auxey-Duresses',white:262,red:2075,app:129},
 {name:'Saint-Romain',white:2048,red:1157,app:228},
 {name:'Santenay',white:1159,red:2082,app:230},
 {name:'Maranges',white:797,red:2061,app:198},
]){
 test(`${village.name} colour selects the official area and unknown colour keeps a combined overview`,async({page})=>{
  for(const fields of [
   {colour:'White',wineStyle:'white',id:`inao-denom-${village.white}`},
   {colour:'Red',wineStyle:'red',id:`inao-denom-${village.red}`},
   {colour:'',wineStyle:'white',id:`inao-denom-${village.white}`},
   {colour:null,wineStyle:null,id:`inao-app-${village.app}-village`},
  ]){
   const {id,...wineFields}=fields;
   await setup(page,{...wineFields,appellation:village.name,wineName:village.name,classification:'village'});await page.goto('/wines/layout-wine');
   await page.getByRole('button',{name:'View village map'}).click();
   const dialog=page.getByRole('dialog',{name:village.name,exact:true});
   await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
   await expect(dialog.getByRole('combobox')).toHaveValue(id);
   await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
   await expect(dialog.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
   await page.keyboard.press('Escape');
  }
 });
}

for(const grand of [{name:'Montrachet',id:927},{name:'Bâtard-Montrachet',id:273}]){
 test(`${grand.name} opens its full shared boundary in Puligny`,async({page})=>{
  await setup(page,{appellation:grand.name,wineName:grand.name,classification:'grand_cru',colour:'White',wineStyle:'white'});
  await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Puligny-Montrachet',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(`inao-denom-${grand.id}`);
  await expect(dialog.locator('.village-map-overlap')).toContainText('Puligny-Montrachet and Chassagne-Montrachet');
 });
}

test('a white Blagny record does not select the red appellation boundary',async({page})=>{
 await setup(page,{appellation:'Blagny',wineName:'La Pièce sous le Bois',colour:'White',wineStyle:'white'});
 await page.goto('/wines/layout-wine');
 await expect(page.getByRole('heading',{name:'La Pièce sous le Bois',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
});

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`Corton ${route}: named climats retain local identities, while unnamed wines show the appellation`,async({page},testInfo)=>{
  await setup(page,{appellation:'Corton',wineName:'Corton Les Bressandes',classification:'grand_cru'});
  await page.goto(route);const opener=page.getByRole('button',{name:'View village map'});await opener.click();
  const dialog=page.getByRole('dialog',{name:'Aloxe-Corton',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  const select=dialog.getByRole('combobox');
  await expect(select).toHaveValue('inao-denom-2357');
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Corton Les Bressandes');
  await expect(dialog.locator('.village-map-context')).toContainText('3 Grand Crus · 24 Grand Cru climats · 14 Premier Cru climats');
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveCount(0);
  await select.selectOption('inao-denom-550');
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Corton-Charlemagne');
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas: Corton-Charlemagne/})).toBeVisible();
  await select.selectOption('inao-denom-549');
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await expect(dialog.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
  await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas: Corton appellation/})).toBeVisible();
  await dialog.getByRole('button',{name:'Back to this wine'}).click();
  await expect(select).toHaveValue('inao-denom-2357');
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   await dialog.getByRole('button',{name:'Village view',exact:true}).click();
   expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
   await page.screenshot({path:testInfo.outputPath(`corton-climat-${width}.png`)});
  }
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();
 });
}

test('Corton broad, mixed, unsupported and white records keep appellation scope',async({page})=>{
 for(const fields of [
  {wineName:'Corton'},
  {wineName:'Les Bressandes et Les Renardes'},
  {wineName:'Clos des Cortons Faiveley'},
  {wineName:'Les Vergennes',colour:'White',wineStyle:'white'},
 ]){
  await setup(page,{appellation:'Corton',classification:'grand_cru',...fields});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Aloxe-Corton',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-549');
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await expect(dialog.getByText('Appellation area shown; no single vineyard is identified.')).toBeVisible();
  await page.keyboard.press('Escape');
 }
});

test('new village broad wines keep a light appellation tint without a single-cru label',async({page})=>{
 for(const fields of [
  {appellation:'Morey-Saint-Denis',wineName:'Morey-Saint-Denis Premier Cru',classification:'premier_cru',id:'inao-denom-949'},
  {appellation:'Chambolle-Musigny',wineName:'Chambolle-Musigny Vieilles Vignes',classification:'village',id:'inao-denom-449'},
  {appellation:'Vosne-Romanée',wineName:'Vosne-Romanée Premier Cru',classification:'premier_cru',id:'inao-denom-1277'},
  {appellation:'Vosne-Romanée',wineName:'Vosne-Romanée Vieilles Vignes',classification:'village',id:'inao-denom-1262'},
  {appellation:'Beaune',wineName:'Les Cent Vignes et Les Bressandes',classification:'premier_cru',id:'inao-denom-350'},
  {appellation:'Pommard',wineName:'Les Rugiens',classification:'premier_cru',id:'inao-denom-1054'},
  {appellation:'Volnay',wineName:'Volnay Vieilles Vignes',classification:'village',id:'inao-denom-1225'},
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

test('Volnay Santenots explains Meursault coverage and keeps the whole named area',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page,{appellation:'Volnay',wineName:'Santenots du Milieu'});await page.goto('/wines/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Volnay',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-1259');
 await expect(dialog.locator('.village-map-selected-label')).toHaveText('Santenots');
 await expect(dialog.locator('.village-map-overlap')).toContainText('Santenots lies in Meursault');
 await expect(dialog.locator('.village-map-overlap')).toContainText('smaller plots such as Santenots du Milieu have no separate Volnay boundary here');
 await expect(dialog.getByRole('link',{name:/Explore on Burgundy Atlas/})).toHaveAttribute('href',/\/santenots$/);
 await page.screenshot({path:testInfo.outputPath('volnay-santenots-390.png')});
});

test('Beaune and Volnay label spellings select the reviewed cru',async({page})=>{
 for(const [appellation,wineName,id,colour] of [
  ['Beaune','Les Cent Vignes','inao-denom-330','White'],
  ['Volnay','Les Taillepieds','inao-denom-1260','Red'],
  ['Beaune','Vignes Franches Clos des Ursules','inao-denom-319','Red'],
  ['Volnay','Caillerets Clos des 60 Ouvrées','inao-denom-1252','Red'],
  ['Beaune','Bouchard Père & Fils Beaune Grèves','inao-denom-334','Red'],
  ['Gevrey-Chambertin','Lavaux Saint-Jacques','inao-denom-609','Red'],
  ['Mercurey','Clos du Roi','inao-denom-827','Red'],
  ['Givry','Cellier aux Moines','inao-denom-618','Red'],
  ['Pouilly-Fuissé','Clos Reyssié','inao-denom-2867','White'],
 ]){
  await setup(page,{appellation,wineName,colour});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(id);
  await page.keyboard.press('Escape');
 }
});

test('a red Meursault Santenots opens Volnay Santenots with the explanation',async({page})=>{
 await setup(page,{appellation:'Meursault',wineName:'Santenots',colour:'Red'});await page.goto('/wines/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Volnay',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-1259');
 await expect(dialog.locator('.village-map-overlap')).toContainText('a red wine recorded as Meursault Santenots is shown here');
});

test('Savigny, Auxey and Monthélie producer spellings select the reviewed cru',async({page})=>{
 for(const [appellation,wineName,id,selected,note] of [
  ['Savigny-lès-Beaune','Albert Morot La Bataillère aux Vergelesses Premier Cru','inao-denom-1180','Bataillère','separate from Les Vergelesses'],
  ['Auxey-Duresses','Les Bretterins','inao-denom-267','Les Bréterins',''],
  ['Auxey-Duresses','Les Ecusseaux','inao-denom-269','Les Ecussaux',''],
  ['Auxey-Duresses','Les Bretterins dit La Chapelle','inao-denom-266','La Chapelle','is shown as La Chapelle'],
  ['Monthélie','MJ Tricot Clos Les Champs Fulliot','inao-denom-921','Les Champs Fulliots','whole Les Champs Fulliots Premier Cru'],
 ]){
  await setup(page,{appellation,wineName});await page.goto('/shared/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(id);
  await expect(dialog.locator('.village-map-selected-label')).toHaveText(selected);
  if(note)await expect(dialog.locator('.village-map-overlap')).toContainText(note);
  await page.keyboard.press('Escape');
 }
});

test('Chorey and Saint-Romain explain missing plot boundaries and reject a Premier Cru tier',async({page})=>{
 for(const [appellation,wineName] of [['Chorey-lès-Beaune','Les Beaumonts'],['Saint-Romain','Sous la Velle']]){
  await setup(page,{appellation,wineName,classification:'village'});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox').locator('option')).toHaveCount(3);
  await expect(dialog.locator('.village-map-overlap')).toContainText('Named vineyards are not mapped individually');
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await setup(page,{appellation,wineName,classification:'premier_cru'});await page.reload();
  await expect(page.getByRole('heading',{name:wineName,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
 }
});

test('white Pommard and Volnay records do not select a red-wine map',async({page})=>{
 for(const [appellation,wineName] of [['Pommard','Clos Blanc'],['Volnay','Santenots']]){
  await setup(page,{appellation,wineName,colour:'White',wineStyle:'white'});await page.goto('/wines/layout-wine');
  await expect(page.getByRole('heading',{name:wineName,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
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

test('Côte de Nuits-Villages names its two separate parts and zooms to each',async({page})=>{
 // Label visibility switches at a zoom threshold, so use a stable canvas size.
 await page.setViewportSize({width:1280,height:900});
 await setup(page,{appellation:'Côte de Nuits-Villages',wineName:'Côte de Nuits-Villages',classification:'village'});
 await page.goto('/wines/layout-wine');await page.evaluate(()=>document.fonts.ready);
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Côte de Nuits-Villages',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 const labels=dialog.locator('.village-map-area-name');
 await expect(labels).toHaveText(['Fixin & Brochon','Premeaux-Prissey, Comblanchien & Corgoloin']);
 await expect(labels.first()).toHaveCSS('visibility','visible');
 await expect(dialog.locator('.village-map-context')).toContainText('Fixin, Brochon, Premeaux-Prissey, Comblanchien & Corgoloin');
 // Each part is one click away; its name gives way to the vineyards there.
 await dialog.getByRole('button',{name:'North: Fixin & Brochon'}).click();
 await expect(labels.first()).toHaveCSS('visibility','hidden');
 await dialog.getByRole('button',{name:'South: Premeaux-Prissey, Comblanchien & Corgoloin'}).click();
 await expect(labels.last()).toHaveCSS('visibility','hidden');
 await dialog.getByRole('button',{name:'Village view',exact:true}).click();
 await expect(labels.first()).toHaveCSS('visibility','visible');
});

test('an umbrella Premier Cru says what it covers; a cru that overlaps nothing has no note',async({page})=>{
 await setup(page,{appellation:'Chassagne-Montrachet',wineName:'Morgeot',classification:'premier_cru',colour:'White',wineStyle:'white'});
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Chassagne-Montrachet',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.locator('.village-map-overlap')).toContainText('Morgeot is a wider Premier Cru name covering 19 named vineyards');
 await dialog.getByRole('combobox').selectOption({label:'La Romanée'});
 await expect(dialog.locator('.village-map-overlap')).toHaveText('La Romanée lies within La Grande Montagne, a wider Premier Cru name.');
 await page.keyboard.press('Escape');
 await setup(page,{appellation:'Meursault',wineName:'Meursault Charmes',classification:'premier_cru',colour:'White',wineStyle:'white'});
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const meursault=page.getByRole('dialog',{name:'Meursault',exact:true});
 await expect(meursault.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(meursault.locator('.village-map-overlap')).toHaveCount(0);
});
