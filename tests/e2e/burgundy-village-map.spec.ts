import { test,expect,type Locator,type Page } from '@playwright/test';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import { wine } from './fixtures/layoutWine';
import {ownerName} from '../../src/lib/places/parcelOwners';
import {groupParcelRightHolders,type HolderResearch} from '../../src/lib/places/parcelPresentation';
import type {Parcels} from '../../src/features/vineyards/GrandCruParcels';
import type {ParcelEvidenceData} from '../../src/features/vineyards/ParcelEvidence';
import {unlistedRegionalMapIds} from '../../src/lib/places/unlistedRegionalMaps';

const fullMapMatrix=process.env.WINELOG_E2E_EXHAUSTIVE_MAPS==='1';
const losslessMaps=JSON.parse(readFileSync('src/lib/places/burgundyLosslessMapRegistry.json','utf8')) as Record<string,{brotliJsonUrl:string;gzipJsonUrl:string}>;
const matrixTest=fullMapMatrix?test:test.skip;
const allMapRoutes=['/wines/layout-wine','/shared/layout-wine'] as const;
const matrixRoutes:readonly string[]=fullMapMatrix?allMapRoutes:['/wines/layout-wine'];

// Only crus with a committed commune-edge audit reach the app (scripts/grand_cru.py app_cru_slugs);
// the others' history files are checked by the unit and Python tests instead.
const auditedCru=(slug:string)=>existsSync(`scripts/grand-crus/reports/${slug}-commune-audit.json`);
// White-only crus need a white wine for their village map to open.
const whiteCru=(slug:string)=>/chablis|montrachet|charlemagne/.test(slug);
// Cover each app-visible history bundle on a real map.
const historyCrus=[...new Set(['echezeaux','clos-de-vougeot',...(process.env.WINELOG_E2E_CRU?[process.env.WINELOG_E2E_CRU]:[])])];
for(const [index,slug] of historyCrus.filter(auditedCru).entries()){
 test(`Official history: ${slug} loads its own evidence and preserves dated source roles`,async({page},testInfo)=>{
  test.setTimeout(60_000); // Allow a cold local Vite/Worker startup before the real map assertions.
  const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
  const cru=read(`scripts/grand-crus/${slug}.json`) as {name:string;parentFeatureId:string;villageMaps:string[];evidenceFrom:string[]};
  const evidence=read(`src/lib/places/grandCruParcels/${slug}.evidence.json`) as ParcelEvidenceData;
  const [parcelId,trace]=Object.entries(evidence.tracing!).find(([,t])=>t.earliestSupportedEvent.dateRole==='dfi-validation')!;
  const villages=read('src/lib/places/burgundyVillageMapRegistry.json').villages as {id:string;name:string}[];
  const names=cru.villageMaps.map(id=>villages.find(v=>v.id===id)!.name);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:slug==='chablis-grand-cru'?320:390,height:900});
  await setup(page,{appellation:cru.name,wineName:cru.name,classification:'grand_cru',
   ...(whiteCru(slug)?{colour:'White',wineStyle:'white'}:{})});
  const loaded=new Set<string>();
  page.on('request',request=>{
   const match=request.url().match(/grandCruParcels\/([^/?]+)\.evidence\.json/);
   if(match)loaded.add(match[1]);
  });
  await page.goto(allMapRoutes[index%2],{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName(new RegExp(`^(${names.join('|')})$`));
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await dialog.getByRole('combobox',{name:'Explore a vineyard'}).selectOption(cru.parentFeatureId);
  expect([...loaded]).toEqual([]);
  await dialog.getByRole('switch',{name:`Parcel rights · ${cru.name}`}).check();
  await dialog.getByText('Find a parcel by cadastral reference').click();
  await dialog.getByLabel('Cadastral parcel').selectOption(parcelId);
  const panel=dialog.getByRole('region',{name:'History and evidence'});
  await expect(panel).toBeVisible();
  const history=panel.locator('details.parcel-evidence-history');
  if(!await history.evaluate((el:HTMLDetailsElement)=>el.open))await history.locator('summary').click();
  await expect(history.getByText('DFI validation date',{exact:true}).first()).toBeVisible();
  await expect(history.locator(`time[datetime="${trace.earliestSupportedEvent.date}"]`).first()).toBeVisible();
  await expect(panel.getByText('Verified operator',{exact:true})).toHaveCount(0);
  expect([...loaded].sort()).toEqual([...cru.evidenceFrom].sort());
  // Source coverage and tracing stay in the research files; readers see the dated records only.
  await expect(panel.getByText('Source coverage and tracing',{exact:true})).toHaveCount(0);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(dialog.locator('.village-map-canvas')).toBeInViewport();
  await page.screenshot({path:testInfo.outputPath(`${slug}-official-history-mobile.png`)});
 });
}

test('Échezeaux: link the wine’s producer in one tap and keep it in owner and shared views',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await setup(page,{appellation:'Échezeaux',wineName:'Échezeaux',classification:'grand_cru',producer:'Domaine Nicole Lamarche',producerId:'nicole'});
 let links:{holderId:string;producerId:string;producerName:string;status:string;updatedAt:string}[]=[],catalogue=0;
 // The map opens from the wine, so its producer is known: the catalogue is never needed.
 await page.route('**/api/producers',route=>{catalogue++;return route.fulfill({json:{items:[]}})});
 await page.route('**/api/parcel-producer-links?*',async route=>{
  const request=route.request();
  if(request.method()==='PUT'){
   const input=request.postDataJSON(),saved={...input,producerName:'Domaine Nicole Lamarche',status:'manual',updatedAt:'2026-10-08'};
   links=[...links.filter(l=>l.holderId!==input.holderId),saved];
   return route.fulfill({json:saved});
  }
  if(request.method()==='DELETE'){const input=request.postDataJSON();links=links.filter(l=>l.holderId!==input.holderId);return route.fulfill({json:{deleted:true}})}
  return route.fulfill({json:{items:links}});
 });
 await page.setViewportSize({width:390,height:844});
 const open=async(path:string)=>{
  await page.goto(path);await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await dialog.getByRole('switch',{name:'Parcel rights · Échezeaux'}).check();return dialog;
 };
 let dialog=await open('/wines/layout-wine');
 let card=dialog.getByRole('region',{name:'This wine’s producer'});
 await expect(card).toContainText('Looks like Domaine Nicole Lamarche');
 await expect(dialog.getByRole('checkbox',{name:/Show possible matches/})).toHaveCount(0);
 await card.getByRole('button',{name:'Show on map'}).click();
 await expect(dialog.locator('.village-map-canvas')).toBeInViewport();
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeInViewport();
 await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
 await expect(dialog.getByLabel('Map legend')).not.toContainText('possible');
 await page.screenshot({path:testInfo.outputPath('producer-suggestion-mobile.png')});
 await card.getByRole('button',{name:'Link Domaine Nicole Lamarche to Domaine Nicole Lamarche',exact:true}).click();
 await expect(card.getByText('Manual link · unverified',{exact:true})).toBeVisible();
 expect(links.map(l=>[l.holderId,l.producerId])).toEqual([['397738634','nicole']]);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 // A fresh shared-wine view reloads the saved account association.
 dialog=await open('/shared/layout-wine');
 card=dialog.getByRole('region',{name:'This wine’s producer'});
 await expect(card).toContainText('Linked to Domaine Nicole Lamarche');
 // The link for this wine's producer opens the map on that holder's parcels, not the whole cru.
 await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
 await card.getByRole('button',{name:'Show on map'}).click();
 await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
 await expect(dialog.getByText('Verified parcel links')).toHaveCount(0);
 // The chosen row offers the same link: unlink it there, then link it again in one tap.
 const owners=dialog.getByRole('list',{name:'Recorded right holders by mapped area'});
 await owners.getByRole('button',{name:'Unlink',exact:true}).click();
 await expect(card).toContainText('Not linked to any parcels yet.');
 expect(links).toEqual([]);
 await owners.getByRole('button',{name:'Link to Domaine Nicole Lamarche',exact:true}).click();
 await expect(card.getByText('Manual link · unverified',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('producer-linked-row-mobile.png')});
 expect(catalogue).toBe(0);
});

for(const viewport of [{width:390,height:844},{width:1280,height:800}])test(`Échezeaux: the map stays in view while choosing an owner or parcel at ${viewport.width}px`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await setup(page,{appellation:'Échezeaux',wineName:'Échezeaux',classification:'grand_cru',producer:'Domaine Nicole Lamarche'});
 await page.route('**/api/producers',route=>route.fulfill({json:{items:[]}}));
 await page.route('**/api/parcel-producer-links?*',route=>route.fulfill({json:{items:[]}}));
 await page.setViewportSize(viewport);
 await page.goto('/wines/layout-wine',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await dialog.getByRole('switch',{name:'Parcel rights · Échezeaux'}).check();
 const canvas=dialog.locator('.village-map-canvas'),owners=dialog.locator('ul.village-map-owners');
 // The rows regroup once domaine research loads; wait for its key so the rows below stay attached.
 await expect(dialog.getByText('Link strength',{exact:true})).toBeVisible();
 await expect(owners.locator('li').last()).toBeVisible();
 // Scroll down to the owner list: the map must still be on screen, under the header.
 await owners.locator('li').last().scrollIntoViewIfNeeded();
 await expect(canvas).toBeInViewport({ratio:0.95});
 const headerBottom=await dialog.locator('.village-map-header').evaluate(el=>el.getBoundingClientRect().bottom);
 expect((await canvas.boundingBox())!.y).toBeGreaterThanOrEqual(headerBottom-1);
 await owners.getByRole('button').first().click();
 await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
 await expect(canvas).toBeInViewport({ratio:0.95});
 // A parcel picked from the finder at the foot of the panel shows its evidence without moving the map.
 await dialog.getByText('Find a parcel by cadastral reference').click();
 await dialog.getByLabel('Cadastral parcel').selectOption('212670000D0665');
 const evidence=dialog.getByRole('region',{name:'History and evidence'});
 await expect(evidence.getByText('Authorisation decision',{exact:true})).toBeVisible();
 await expect(evidence.getByText('Authorisation decision',{exact:true})).toBeInViewport();
 await expect(canvas).toBeInViewport({ratio:0.95});
 const box=(await evidence.boundingBox())!,map=(await canvas.boundingBox())!;
 if(viewport.width<=740)expect(box.y).toBeGreaterThanOrEqual(map.y+map.height-1);  // never hidden behind the pinned map
 // Sections fold away on request and come back with a click.
 const notices=evidence.locator('details.parcel-evidence-notices'),ownerSection=dialog.locator('details.village-map-owner-section');
 await expect(notices).toHaveJSProperty('open',true);
 await notices.locator('summary').click();
 await expect(evidence.getByText('Authorisation decision',{exact:true})).toBeHidden();
 await notices.locator('summary').click();
 await expect(evidence.getByText('Authorisation decision',{exact:true})).toBeVisible();
 await ownerSection.locator('summary').click();
 await expect(owners).toBeHidden();
 await ownerSection.locator('summary').click();
 await expect(owners).toBeVisible();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

for(const route of allMapRoutes){
 test(`Échezeaux pilot ${route}: named areas, parcels and dated rights stay distinct`,async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page,{appellation:'Échezeaux',wineName:'Échezeaux Les Treux',classification:'grand_cru'});
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/maps/'))requests.push(r.url())});
  await page.goto(route);
  expect(requests).toEqual([]);
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  const vineyard=dialog.getByRole('combobox',{name:'Explore a vineyard'});
  await expect(vineyard).toHaveValue('echezeaux-plot-les-treux');
  await expect(dialog.locator('.village-map-tier')).toHaveText('Named area · Échezeaux Grand Cru');
  await expect(dialog.locator('.village-map-description')).toContainText('not a separately delimited cru');
  await expect(dialog.locator('.village-map-context')).toContainText('8 Grand Crus');
  await expect(dialog.locator('.village-map-note')).toContainText(['Échezeaux pilot: 10']);
  expect(requests.some(url=>url.includes('echezeaux-named-plots.'))).toBe(true);
  expect(requests.some(url=>url.includes('echezeaux-parcels.'))).toBe(false);
  const toggle=dialog.getByRole('switch',{name:'Parcel rights · Échezeaux'});
  await toggle.check();
  const owners=dialog.getByRole('list',{name:'Recorded right holders by mapped area'});
  // Rows are grouped by researched domaine; there is no legal-holder switch.
  await expect(dialog.getByLabel('Group right holders by')).toHaveCount(0);
  await expect(owners.getByRole('button')).toHaveCount(6);
  // The reference finder stays folded; it is the keyboard route to any parcel.
  await dialog.getByText('Find a parcel by cadastral reference').click();
  const parcel=dialog.getByRole('combobox',{name:'Cadastral parcel'});
  await expect(parcel.getByRole('option')).toHaveCount(277);
  expect(requests.some(url=>url.includes('echezeaux-parcels.'))).toBe(true);
  // One legend: the parcel keys join the cru keys under the map.
  await expect(dialog.getByLabel('Map legend')).toContainText('No matched rights');
  const drc=owners.getByRole('button',{name:/^Domaine de la Romanée-Conti/});
  await expect(drc).toHaveAttribute('aria-pressed','false');
  await drc.click();
  await expect(drc).toHaveAttribute('aria-pressed','true');
  await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
  const known=await parcel.locator('option',{hasText:'Domaine de la Romanee Conti'}).first().getAttribute('value');
  await parcel.selectOption(known!);
  const details=dialog.locator('.village-map-parcel-details');
  await expect(details).toContainText('Domaine de la Romanee Conti');
  await expect(details.getByText('SIREN',{exact:false})).toBeHidden();
  await details.getByText('Record details').click();
  await expect(details).toContainText('Rights recorded as of 1 January 2025');
  await page.screenshot({path:testInfo.outputPath('echezeaux-recorded-rights-mobile.png')});
  const unknown=await parcel.locator('option',{hasText:'no matched rights record'}).first().getAttribute('value');
  await parcel.selectOption(unknown!);
  await expect(details).toContainText('doesn’t mean the parcel has no owner');
  await toggle.uncheck();await expect(owners).toHaveCount(0);
  await expect(dialog.getByLabel('Map legend')).not.toContainText('No matched rights');
  await vineyard.selectOption('inao-denom-645');
  await expect(dialog.locator('.village-map-description')).toContainText('INAO production boundary');
  await dialog.getByRole('switch',{name:'Parcel rights · Grands-Échezeaux'}).check();
  await dialog.getByText('Find a parcel by cadastral reference').click();
  await expect(dialog.getByRole('combobox',{name:'Cadastral parcel'}).getByRole('option')).toHaveCount(33);
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:testInfo.outputPath('grands-echezeaux-parcels-desktop.png')});
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'View village map'})).toBeFocused();
 });
}

// One representative parcel journey, parameterised by scripts/grand-crus/<slug>.json, so the Chromium
// matrix does not grow with each cru. WINELOG_E2E_CRU picks another configured cru.
const parcelCru=(()=>{
 const slug=process.env.WINELOG_E2E_CRU??'grands-echezeaux';
 if(!auditedCru(slug))throw new Error(`${slug} is hidden from the app until its commune-edge audit is committed`);
 const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
 const cru=read(`scripts/grand-crus/${slug}.json`) as {slug:string;name:string;parentFeatureId:string;bundle:string;villageMaps:string[];evidenceFrom:string[];namedPlots?:{displayLayer?:boolean;plots:{id:string;name:string}[]}};
 const manifest=read(`src/lib/places/grandCruParcels/${cru.bundle}.manifest.json`) as {dataUrl:string;rightsAsOf:string};
 const features=(read(`public${manifest.dataUrl}`) as Parcels).features
  .filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===cru.parentFeatureId));
 const parcels=features.map(f=>f.properties.id);
 const research=cru.evidenceFrom.map(source=>read(`src/lib/places/grandCruParcels/${source}.evidence.json`));
 const evidenced=research.flatMap(source=>Object.keys(source.parcels)).filter(id=>parcels.includes(id)).sort();
 const hasDomaineLinks=research.some(source=>Object.keys(source.holderDomains).length>0);
 const holders=new Set(features.flatMap(f=>f.properties.recordedRights.map(r=>r.holderId))).size;
 // The holder list always groups by researched domaine, so the journey picks a row that stands for one legal holder.
 const holderDomains:Record<string,HolderResearch>={};
 for(const source of research)for(const [id,item] of Object.entries(source.holderDomains as Record<string,HolderResearch>))holderDomains[id]??=item;
 const rows=groupParcelRightHolders(features,cru.parentFeatureId,holderDomains);
 const row=rows.find(g=>g.holderIds.length===1&&rows.filter(o=>o.name===g.name).length===1)!;
 const unknown=features.find(f=>!f.properties.recordedRights.length);
 const multiple=features.find(f=>f.properties.recordedRights.length>1);
 // A cross-commune cru can open in a configured village other than the bundle's first one.
 const villages=(read('src/lib/places/burgundyVillageMapRegistry.json') as {villages:{id:string;name:string}[]}).villages.filter(v=>cru.villageMaps.includes(v.id)).map(v=>v.name);
 return {...cru,villages,dataUrl:manifest.dataUrl,rightsAsOf:manifest.rightsAsOf,parcels,evidenced,hasDomaineLinks,holders,rows:rows.length,row,unknown,multiple};
})();

test(`Grand Cru parcels: ${parcelCru.name} gets rights, evidence and scoped producer links from its config`,async({page},testInfo)=>{
 test.setTimeout(60_000); // Corton's 728 parcels make this the longest journey under parallel workers.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 const producer={id:'parcel-test',canonicalName:'Parcel test producer'};
 await setup(page,{appellation:parcelCru.name,wineName:parcelCru.name,classification:'grand_cru',producer:producer.canonicalName,producerId:producer.id,
  ...(whiteCru(parcelCru.slug)?{colour:'White',wineStyle:'white'}:{})});
 let links:{holderId:string;producerId:string;producerName:string;status:string;updatedAt:string}[]=[],catalogue=0;
 await page.route('**/api/producers',route=>{catalogue++;return route.fulfill({json:{items:[producer]}})});
 await page.route('**/api/parcel-producer-links?*',async route=>{
  const request=route.request(),query=new URL(request.url()).searchParams;
  expect(query.get('parent')).toBe(parcelCru.parentFeatureId);
  expect(query.get('snapshot')).toBe(parcelCru.rightsAsOf);
  if(request.method()==='PUT'){
   const input=request.postDataJSON(),saved={...input,producerName:producer.canonicalName,status:'manual',updatedAt:'2026-10-01'};
   links=[...links.filter(l=>l.holderId!==input.holderId),saved];
   return route.fulfill({json:saved});
  }
  if(request.method()==='DELETE'){const input=request.postDataJSON();links=links.filter(l=>l.holderId!==input.holderId);return route.fulfill({json:{deleted:true}})}
  return route.fulfill({json:{items:links}});
 });
 let downloads=0;
 await page.route(`**${parcelCru.dataUrl}`,route=>++downloads===1?route.fulfill({status:503}):route.continue());
 await page.goto('/wines/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 let dialog=page.getByRole('dialog');
 await expect(dialog).toHaveAccessibleName(new RegExp(`^(${parcelCru.villages.join('|')})$`));
 await expect(dialog.getByRole('combobox',{name:'Explore a vineyard'})).toHaveValue(parcelCru.parentFeatureId);
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 expect(downloads).toBe(0);
 if(parcelCru.namedPlots&&parcelCru.namedPlots.displayLayer!==false){
  const plot=parcelCru.namedPlots.plots[0];
  await dialog.getByRole('combobox',{name:'Explore a vineyard'}).selectOption(`${parcelCru.slug}-plot-${plot.id}`);
  await expect(dialog.getByRole('heading',{name:plot.name,exact:true})).toBeVisible();
  await expect(dialog.getByText(`Cadastral named area within ${parcelCru.name} Grand Cru`,{exact:false})).toBeVisible();
  await expect(dialog.getByRole('switch',{name:`Parcel rights · ${parcelCru.name}`})).toBeVisible();
  await dialog.getByRole('combobox',{name:'Explore a vineyard'}).selectOption(parcelCru.parentFeatureId);
 }
 const toggle=dialog.getByRole('switch',{name:`Parcel rights · ${parcelCru.name}`});
 await toggle.focus();await page.keyboard.press('Space');
 await expect(dialog.getByRole('alert')).toContainText('The cru map remains available');
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'Retry parcels'}).click();
 await expect(dialog.getByText(`${parcelCru.parcels.length} parcels in ${parcelCru.name}`,{exact:false})).toBeVisible();
 expect(downloads).toBe(2);
 await expect(dialog.getByLabel('Group right holders by')).toHaveCount(0);
 // The research explanation sits under the folded About this data.
 if(parcelCru.hasDomaineLinks)await expect(dialog.getByText(/Domaine headings are research links/)).toBeAttached();
 await dialog.getByText('Find a parcel by cadastral reference').click();
 const parcel=dialog.getByRole('combobox',{name:'Cadastral parcel'});
 await expect(parcel.getByRole('option')).toHaveCount(parcelCru.parcels.length+1);
 await parcel.selectOption(parcelCru.evidenced[0]??parcelCru.parcels[0]);
 const details=dialog.locator('.village-map-parcel-details');
 if(parcelCru.evidenced.length)await expect(details.getByRole('region',{name:'History and evidence'})).toBeVisible();
 // Every parcel has #461 source coverage and tracing, so the region shows even without dated records.
 else{
  await expect(details.getByRole('region',{name:'History and evidence'})).toBeVisible();
  await expect(details).toContainText('No matched dated rights, sale or notice records in the reviewed sources.');
 }
 await expect(details.getByText('Verified operator')).toHaveCount(0);
 if(parcelCru.unknown){
  await parcel.selectOption(parcelCru.unknown.properties.id);
  await expect(details).toContainText('No matched rights record');
  await expect(details).toContainText('doesn’t mean the parcel has no owner');
 }
 if(parcelCru.multiple){
  await parcel.selectOption(parcelCru.multiple.properties.id);
  for(const right of parcelCru.multiple.properties.recordedRights)await expect(details.getByText(`${ownerName(right.name)} · ${right.rightLabel}`,{exact:true})).toBeVisible();
 }
 const holderSection=dialog.locator('.village-map-owner-section');
 if(!await holderSection.getByRole('list').isVisible())await holderSection.locator('summary').click();
 if(parcelCru.rows>6)await dialog.getByRole('button',{name:`Show all ${parcelCru.rows} ${parcelCru.hasDomaineLinks?'entries':'right holders'}`,exact:true}).click();
 const holderList=dialog.getByRole('list',{name:'Recorded right holders by mapped area'});
 await expect(holderList.getByRole('button')).toHaveCount(parcelCru.rows);
 await expect(holderSection.locator('.village-map-count')).toHaveText(`${parcelCru.rows}`);
 const holder={holderId:parcelCru.row.holderIds[0],name:parcelCru.row.legalNames[0]};
 if(parcelCru.rows>6)await dialog.getByRole('searchbox',{name:'Search right holders'}).fill(holder.name);
 const rowName=new RegExp(`^${parcelCru.row.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\u00a0?$`);
 await holderList.getByRole('button').filter({has:page.locator('.village-map-owner-name',{hasText:rowName})}).click();
 await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
 await expect(dialog.locator('.village-map-canvas')).toBeInViewport();
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeInViewport();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath(`${parcelCru.bundle}-holders-mobile.png`)});
 // The wine's producer is known, so the chosen row links to it in one tap.
 await holderList.getByRole('button',{name:`Link to ${producer.canonicalName}`,exact:true}).click();
 await expect(holderList.getByText(`Linked to ${producer.canonicalName}`,{exact:true})).toBeVisible();
 await expect(dialog.getByRole('region',{name:'This wine’s producer'}).getByText('Manual link · unverified',{exact:true})).toBeVisible();
 expect(links.map(l=>[l.holderId,l.producerId])).toEqual([[holder.holderId,producer.id]]);
 await page.goto('/shared/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 dialog=page.getByRole('dialog');
 await expect(dialog).toHaveAccessibleName(new RegExp(`^(${parcelCru.villages.join('|')})$`));
 await dialog.getByRole('switch',{name:`Parcel rights · ${parcelCru.name}`}).check();
 const card=dialog.getByRole('region',{name:'This wine’s producer'});
 await expect(card).toContainText(`Linked to ${parcelCru.row.name}`);
 await expect(dialog.getByLabel('Map legend')).toContainText('Chosen right holder');
 await page.setViewportSize({width:1280,height:900});
 await expect(dialog.locator('.village-map-canvas')).toBeInViewport();
 await page.screenshot({path:testInfo.outputPath(`${parcelCru.bundle}-linked-shared-desktop.png`)});
 await card.getByRole('button',{name:`Unlink ${parcelCru.row.name}`,exact:true}).click();
 await expect(card.getByText('Manual link · unverified',{exact:true})).toHaveCount(0);
 expect(links).toEqual([]);
 expect(catalogue).toBe(0);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'View village map'})).toBeFocused();
});

test('Échezeaux pilot: a verified producer link with no name-only guess',async({page},testInfo)=>{
 await setup(page,{appellation:'Échezeaux',wineName:'Échezeaux',classification:'grand_cru',producer:'Domaine Mongeard-Mugneret'});
 // No verified links are published yet, so this adds one to a copy of the real data.
 await page.route('**/maps/echezeaux-parcels.*',async route=>{
  const data=await (await route.fetch()).json() as {features:{properties:{recordedRights:{name:string}[];domaineLinks:unknown[]}}[]};
  for(const f of data.features)if(f.properties.recordedRights.some(r=>r.name==='DOMAINE MONGEARD MUGNERET'))f.properties.domaineLinks.push({status:'verified',
   name:'Domaine Mongeard-Mugneret',producerId:'mongeard-mugneret',producerNames:['Domaine Mongeard-Mugneret'],role:'operator',effectiveDate:'2025-01-01',
   evidence:[{url:'https://example.test/evidence',note:'Test evidence'}]});
  await route.fulfill({json:data});
 });
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await dialog.getByRole('switch',{name:'Parcel rights · Échezeaux'}).check();
 const card=dialog.locator('.village-map-producer').first();
 await expect(card).toContainText('THIS WINE’S PRODUCER');
 await expect(card).toContainText('Verified parcel links');
 await expect(dialog.getByLabel('Map legend')).toContainText('Producer · verified');
 await expect(dialog.getByRole('checkbox',{name:/Show possible matches/})).toHaveCount(0);
 await expect(dialog.getByText(/Looks like/)).toHaveCount(0);
 await expect(dialog.getByLabel('Map legend')).not.toContainText('possible');
 await page.screenshot({path:testInfo.outputPath('echezeaux-producer-desktop.png')});
});

test('Échezeaux pilot: missing parcel data does not hide the cru and can be retried',async({page})=>{
 await setup(page,{appellation:'Échezeaux',wineName:'Les Poulaillères',classification:'grand_cru'});
 let fail=true;await page.route('**/maps/echezeaux-parcels.*',route=>fail?route.fulfill({status:503}):route.continue());
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Vosne-Romanée',exact:true});
 await expect(dialog.getByRole('combobox',{name:'Explore a vineyard'})).toHaveValue('inao-denom-565');
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await dialog.getByRole('switch',{name:'Parcel rights · Échezeaux'}).check();
 await expect(dialog.getByRole('alert')).toContainText('The cru map remains available');
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 fail=false;await dialog.getByRole('button',{name:'Retry parcels'}).click();
 await expect(dialog.getByRole('list',{name:'Recorded right holders by mapped area'})).toBeVisible();
});

const regionalMapCases=[
 ['Bourgogne Côte d’Or',40,'Dijon','white','A named cuvée'],
 ['Bourgogne Hautes Côtes de Nuits',19,'Arcenant','white','A named cuvée'],
 ['Bourgogne Hautes Côtes de Beaune',29,'Nolay','white','A named cuvée'],
 ['Bourgogne Côte Chalonnaise',44,'Genouilly','white','Buissonnier'],
 ['Bourgogne Côtes du Couchois',6,'Dracy-lès-Couches','red','Sous le Clos'],
 ['Bourgogne Côtes d’Auxerre',5,'Vincelottes','white','Gondonne'],
 ['Bourgogne Chitry',1,'Chitry','white','Olympe'],
 ['Bourgogne Coulanges-la-Vineuse',7,'Charentenay','red','Chanvan'],
 ['Bourgogne Épineuil',1,'Épineuil','red','L’Âme des Dannots'],
 ['Bourgogne Côte Saint-Jacques',1,'Joigny','rose','Vin Gris'],
 ['Bourgogne Tonnerre',6,'Molosmes','white','Vaumorillon'],
 ['Bourgogne La Chapelle Notre-Dame',1,'Ladoix-Serrigny','red','Jean-Pierre Maldant'],
 ['Bourgogne Le Chapitre',1,'Chenôve','red','Vieilles Vignes'],
 ['Bourgogne Montrecul',1,'Dijon','red','Bourgogne Montre-Cul'],
 ['Mâcon Charnay-lès-Mâcon',1,'Charnay-lès-Mâcon','rose','Mâcon Charnay Rosé'],
 ['Mâcon Davayé',1,'Davayé','red','Mâcon Davayé Rouge'],
 ['Mâcon Fuissé',1,'Fuissé','white','Les Tâches'],
 ['Mâcon Loché',1,'Mâcon','white','Les Longues Terres'],
 ['Mâcon Solutré-Pouilly',1,'Solutré-Pouilly','white','Clos des Bertillonnes'],
 ['Mâcon Vergisson',1,'Vergisson','white','Sur la Roche'],
 ['Mâcon Vinzelles',1,'Vinzelles','white','Le Clos de Grand-Père'],
 ['Mâcon Serrières',1,'Serrières','red','Vieilles Vignes'],
 ['Mâcon Montbellet',1,'Montbellet','white','Mâcon-Montbellet'],
 ['Mâcon Uchizy',1,'Uchizy','white','Mâcon-Uchizy'],
 ['Mâcon-Villages',80,'Ozenay','white','AIGAICIA'],
] as const;
const smokeRegionalAppellations=new Set<string>([
 'Bourgogne Côte d’Or',
 'Bourgogne Chitry',
 'Mâcon Loché',
 'Mâcon-Villages',
]);
const browserRegionalCases=fullMapMatrix?regionalMapCases:regionalMapCases.filter(([appellation])=>smokeRegionalAppellations.has(appellation));

for(const route of matrixRoutes)for(const [appellation,count,commune,colour,wineName] of browserRegionalCases){
 test(`Regional map ${appellation} ${route}: full overview, commune navigation and broad scope`,async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:900});
  await setup(page,{appellation,wineName,classification:null,region:appellation.startsWith('Mâcon')?'Saône-et-Loire':['Gondonne','Olympe','Chanvan','L’Âme des Dannots','Vin Gris','Vaumorillon'].includes(wineName)?'Yonne':'Burgundy',colour,wineStyle:colour,productType:'Wine',productSubtype:'Still'});
  const downloads:string[]=[];
  page.on('request',request=>{if(request.url().includes('/maps/'))downloads.push(request.url())});
  await page.goto(route);await page.evaluate(()=>document.fonts.ready);
  expect(downloads).toEqual([]);
  await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  const requestsAfterOpen=downloads.length;
  const selector=dialog.getByRole('combobox',{name:'Zoom to a commune'});
  if(count>1){
   await expect(selector).toHaveValue('');
   await expect(dialog.getByRole('option')).toHaveCount(count+1);
  }else{
   await expect(selector).toHaveCount(0);
   await expect(dialog.locator('.village-map-hint')).toHaveText(`The map shows the full denomination in ${commune}.`);
  }
  await expect(dialog.locator('.village-map-context')).toContainText(`Regional denomination · ${count} commune${count===1?'':'s'}`);
  await expect(dialog.locator('.village-map-tier')).toHaveText('Regional denomination');
  await expect(dialog.locator('.village-map-description')).toContainText('no single vineyard is identified');
  await expect(dialog.locator('.village-map-legend')).not.toContainText('Village appellation');
  await expect(dialog.locator('.village-map-legend')).toHaveText('Appellation overview');
  await expect(dialog.locator('.village-map-overview-note')).toContainText('Small boundary details are omitted');
  await expect.poll(()=>dialog.locator('.village-map-commune-name:visible').count()).toBeLessThanOrEqual(8);
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toHaveCount(0);
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  // Rendered offline commune markers give an independent viewport check. The
  // overview must contain every production anchor, including north and south.
  const positions=()=>dialog.locator('.village-map-commune-name').evaluateAll(elements=>{
   const canvas=elements[0].closest('.village-map-canvas')!.getBoundingClientRect();
   return elements.map(element=>{const b=element.getBoundingClientRect();return {x:b.x+b.width/2-canvas.x,y:b.y+b.height/2-canvas.y,width:canvas.width,height:canvas.height}});
  });
  await expect.poll(async()=>{
   const points=await positions();return points.length===Math.min(count,8)&&points.every(p=>p.x>=0&&p.x<=p.width&&p.y>=0&&p.y<=p.height);
  }).toBe(true);
  if(count>1){
   await selector.selectOption({label:commune});
   await expect.poll(async()=>{const points=await positions();return points.some(p=>p.x<0||p.x>p.width||p.y<0||p.y>p.height)}).toBe(true);
  }
  await expect(dialog.getByRole('heading',{name:appellation,exact:true})).toHaveCount(2);
  await expect(dialog.locator('.village-map-description')).toContainText('Regional production area shown');
  await dialog.getByRole('button',{name:'Region view',exact:true}).click();
  if(count>1)await expect(selector).toHaveValue('');
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

const maconOverviewCases=[
 ['Mâcon Bussières','inao-denom-1717',1,'Bussières',false],
 ['Mâcon Chaintré','inao-denom-1719',3,'Crêches-sur-Saône',true],
 ['Mâcon La Roche-Vineuse','inao-denom-1725',3,'Hurigny',true],
 ['Mâcon Milly-Lamartine','inao-denom-1729',4,'Sologny',true],
 ['Mâcon Pierreclos','inao-denom-1731',1,'Pierreclos',false],
 ['Mâcon Prissé','inao-denom-1732',1,'Prissé',true],
 ['Mâcon Azé','inao-denom-1712',1,'Azé',true],
 ['Mâcon Burgy','inao-denom-1715',1,'Burgy',false],
 ['Mâcon Cruzille','inao-denom-1722',3,'Grevilly',true],
 ['Mâcon Igé','inao-denom-1724',1,'Igé',false],
 ['Mâcon Lugny','inao-denom-1726',4,'Cruzille',true],
 ['Mâcon Péronne','inao-denom-1730',3,'Saint-Maurice-de-Satonnay',false],
 ['Mâcon Verzé','inao-denom-1737',1,'Verzé',false],
 ['Mâcon Bray','inao-denom-1714',4,'Cortambert',true],
 ['Mâcon Chardonnay','inao-denom-1720',4,'Tournus',false],
 ['Mâcon Mancey','inao-denom-1728',12,'Laives',true],
 ['Mâcon Saint-Gengoux-le-National','inao-denom-1734',16,'Bonnay-Saint-Ythaire',true],
 ['Mâcon','inao-denom-1713',88,'Fleurville',true],
] as const;
for(const route of matrixRoutes)for(const [appellation,featureId,count,commune,hasSector] of maconOverviewCases.filter((_,i)=>fullMapMatrix||i===1||i===10||i===16||i===17)){
 test(`Mâcon overview ${appellation} ${route}: overview and source sector stay distinct`,async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:900});
  await setup(page,{appellation,wineName:'Vieilles Vignes',classification:null,colour:'White',wineStyle:'white',region:'Mâconnais'});
  const downloads:string[]=[];page.on('request',r=>{if(r.url().includes('/maps/'))downloads.push(r.url())});
  await page.goto(route);expect(downloads).toEqual([]);
  await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await expect(dialog.locator('.village-map-description')).toContainText('no colour-specific area or single vineyard');
  await expect(dialog.locator('.village-map-context')).toContainText(`${count} commune`);
  await expect.poll(()=>dialog.locator('.village-map-commune-name').evaluateAll(elements=>{
   const canvas=elements[0]?.closest('.village-map-canvas')?.getBoundingClientRect();
   if(!canvas)return 0;
   return elements.filter(el=>{const b=el.getBoundingClientRect();return b.x+b.width/2>=canvas.x&&b.x+b.width/2<=canvas.right&&b.y+b.height/2>=canvas.y&&b.y+b.height/2<=canvas.bottom}).length;
  })).toBe(Math.min(count,8));
  const selector=dialog.getByRole('combobox',{name:'Explore a mapped area'});
  if(hasSector){
   await expect(selector).toHaveValue(featureId);
   await expect(selector.getByRole('option')).toHaveCount(2);
   await selector.selectOption(featureId+'-red-only');
   await expect(dialog.locator('.village-map-eyebrow')).toHaveText('EXPLORING');
   await expect(dialog.locator('.village-map-description')).toContainText('Published red-only sector');
   await expect(dialog.locator('.village-map-overlap')).toContainText('not the whole red-wine area');
  }else await expect(selector).toHaveCount(0);
  if(count>1){
   const communeSelector=dialog.getByRole('combobox',{name:'Zoom to a commune'});
   await expect(communeSelector.getByRole('option')).toHaveCount(count+1);
   await communeSelector.selectOption({label:commune});
   if(hasSector)await expect(selector).toHaveValue(featureId+'-red-only');
  }
  await dialog.getByRole('button',{name:'Region view',exact:true}).click();
  if(hasSector){
   await expect(selector).toHaveValue(featureId+'-red-only');
   await page.screenshot({path:testInfo.outputPath('regional-sector-320.png')});
   await dialog.getByRole('button',{name:'Back to this wine'}).click();
   await expect(selector).toHaveValue(featureId);
   await expect(dialog.locator('.village-map-description')).toContainText('Denomination overview');
  }
  expect([...new Set(downloads)]).toHaveLength(1);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('regional-overview-320.png')});
  await page.setViewportSize({width:1280,height:900});
  await dialog.getByRole('button',{name:'Region view',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('regional-overview-desktop.png')});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'View regional map'})).toBeFocused();
 });
}

// Label permutations are also exercised in burgundyRegionalMap.test.ts. Keep
// these repeated map renders in the exhaustive suite; the normal suite still
// covers split labels, village precedence and the Mâcon overview controls.
for(const route of matrixRoutes)matrixTest(`Northern Mâcon labels distinguish grapes, estates and denominations ${route}`,async({page})=>{
 await page.setViewportSize({width:320,height:900});
 for(const [appellation,wineName,producer,expected] of [
  ['Mâcon-Chardonnay','En Bout','Domaine des Crêts','Mâcon Chardonnay'],
  ['Mâcon','Mancey Les Cadoles Chardonnay','Les Vignerons de Mancey','Mâcon Mancey'],
  ['Mâcon Saint Gengoux','Buissonnier','Vignerons de Buxy','Mâcon Saint-Gengoux-le-National'],
 ] as const){
  await setup(page,{appellation,wineName,producer,colour:'White',wineStyle:'white',classification:null,region:'Mâconnais'});
  await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:expected,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await expect(dialog.locator('.village-map-description')).toContainText('Denomination overview');
  await page.keyboard.press('Escape');
 }
 for(const wineName of ['Chardonnay','Mâcon Chardonnay','Les Vignerons de Mancey Royer Vers']){
  await setup(page,{appellation:'Mâcon',wineName,producer:'Les Vignerons de Mancey-Royer-Vers',colour:'White',wineStyle:'white',classification:null,region:'Mâconnais'});
  await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
  await expect(page.getByRole('dialog',{name:'Mâcon',exact:true}).getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await page.keyboard.press('Escape');
 }
 await setup(page,{appellation:'Mâcon',wineName:'Mâcon St-Gengoux-de-Scissé',classification:null,region:'Mâconnais'});
 await page.goto(route);await expect(page.getByRole('button',{name:'View regional map'})).toHaveCount(0);
});

for(const route of matrixRoutes)matrixTest(`Central Mâcon producer labels and village precedence ${route}`,async({page})=>{
 for(const [appellation,wineName,producer,colour,expected] of [
  ['Mâcon','Lugny Les Charmes','Cave de Lugny','White','Mâcon Lugny'],
  ['Mâcon-Cruzille','Le Gorfou','Cave de Lugny','Red','Mâcon Cruzille'],
  ['Mâcon','Verzé Les Chênes','Domaines Leflaive','White','Mâcon Verzé'],
 ] as const){
  await setup(page,{appellation,wineName,producer,colour,wineStyle:colour.toLowerCase(),classification:null,region:'Mâconnais'});
  await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:expected,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await expect(dialog.locator('.village-map-description')).toContainText('Denomination overview');
  await page.keyboard.press('Escape');
 }
 for(const wineName of ['Cave de Lugny Les Charmes','Les Charmes']){
  await setup(page,{appellation:'Mâcon',wineName,producer:'Cave de Lugny',colour:'White',wineStyle:'white',classification:null,region:'Mâconnais'});
  await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
  await expect(page.getByRole('dialog',{name:'Mâcon',exact:true}).getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await page.keyboard.press('Escape');
 }
 await setup(page,{appellation:'Mâcon',wineName:'Lugny Cruzille',classification:null,region:'Mâconnais'});
 await page.goto(route);await expect(page.getByRole('button',{name:'View regional map'})).toHaveCount(0);
 await setup(page,{appellation:'Viré-Clessé',wineName:'Viré-Clessé',producer:'Cave de Lugny',colour:'White',wineStyle:'white',classification:'village',region:'Mâconnais'});
 await page.goto(route);await expect(page.getByRole('button',{name:'View regional map'})).toHaveCount(0);
 await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('dialog',{name:'Viré-Clessé',exact:true}).getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
});

for(const route of matrixRoutes)test(`Mâcon split labels preserve denomination and Pouilly identities ${route}`,async({page})=>{
 await page.setViewportSize({width:320,height:900});
 for(const [wineName,colour,expected] of [['Fuissé Les Tâches','white','Mâcon Fuissé'],['Charnay Rosé','rose','Mâcon Charnay-lès-Mâcon']] as const){
  await setup(page,{appellation:'Mâcon',wineName,classification:null,colour,wineStyle:colour,region:'Mâconnais'});
  await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:expected,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await expect(dialog.locator('.village-map-note').filter({hasText:'within Mâcon AOC'})).toBeVisible();
  await expect(dialog.locator('.village-map-description')).toContainText('no single vineyard is identified');
  await expect(dialog.locator('.village-map-selected-label')).toHaveCount(0);
  await page.keyboard.press('Escape');
 }
 await setup(page,{appellation:'Pouilly-Fuissé',wineName:'Les Tâches',classification:'village',colour:'White',wineStyle:'white',region:'Mâconnais'});
 await page.goto(route);
 await expect(page.getByRole('button',{name:'View regional map'})).toHaveCount(0);
 await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('dialog',{name:'Pouilly-Fuissé',exact:true}).getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
});

for(const route of matrixRoutes)test(`Le Chapitre appellation transition ${route}`,async({page})=>{
 await page.setViewportSize({width:320,height:900});
 await setup(page,{appellation:'Bourgogne Le Chapitre',wineName:'Le Chapitre Vieilles Vignes 2018',producer:'Domaine Jean Fournier',classification:null,colour:'Red',wineStyle:'red',region:'Côte d’Or'});
 await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
 const regional=page.getByRole('dialog',{name:'Bourgogne Le Chapitre',exact:true});
 await expect(regional.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
 await expect(regional.locator('.village-map-note').filter({hasText:'Marsannay since the 2019 vintage'})).toBeVisible();
 await expect(regional.locator('.village-map-description')).toContainText('no single vineyard is identified');
 await page.keyboard.press('Escape');
 await setup(page,{appellation:'Marsannay',wineName:'Le Chapitre 2019',producer:'Domaine Jean Fournier',classification:'village',colour:'Red',wineStyle:'red',region:'Côte d’Or'});
 await page.goto(route);
 await expect(page.getByRole('button',{name:'View regional map'})).toHaveCount(0);
 await page.getByRole('button',{name:'View village map'}).click();
 const village=page.getByRole('dialog',{name:'Marsannay',exact:true});
 await expect(village.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(village.getByRole('combobox')).toHaveValue('inao-denom-806-red-white');
 await expect(village.locator('.village-map-description')).toContainText('no single vineyard');
 await expect(village.getByRole('option',{name:/Le Chapitre/})).toHaveCount(0);
});

for(const route of matrixRoutes)matrixTest(`Regional colour and geography guards ${route}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const overrides of [
  {appellation:'Bourgogne Côtes du Couchois',colour:'White',wineStyle:'white'},
  {appellation:'Bourgogne Côtes du Couchois',colour:'Rosé',wineStyle:'rose'},
  {appellation:'Bourgogne',region:'Côte Chalonnaise'},
  {appellation:'Bourgogne Côte Chalonnaise',region:'Côte d’Or'},
  {appellation:'Bourgogne Épineuil',colour:'White',wineStyle:'white',region:'Yonne'},
  {appellation:'Bourgogne Tonnerre',colour:'Red',wineStyle:'red',region:'Yonne'},
  {appellation:'Bourgogne Tonnerre',colour:'Rosé',wineStyle:'rose',region:'Yonne'},
  {appellation:'Bourgogne Tonnerre',colour:'White',wineStyle:'red',region:'Yonne'},
  {appellation:'Bourgogne Chitry',colour:'White',wineStyle:'white',region:'Saône-et-Loire'},
  {appellation:'Bourgogne La Chapelle Notre-Dame',region:'Côte de Nuits'},
  {appellation:'Bourgogne Le Chapitre',region:'Côte de Beaune'},
  {appellation:'Bourgogne Montrecul',region:'Yonne'},
 ].filter((_,index)=>fullMapMatrix||[0,2,4,9].includes(index))){
  await setup(page,{classification:null,wineName:'A cuvée',region:'Burgundy',colour:'Red',wineStyle:'red',...overrides});
  await page.goto(route);
  await expect(page.getByRole('heading',{name:'A cuvée',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/View (village|regional) map/})).toHaveCount(0);
 }
 // The rosé restriction belongs to Couchois, not neighbouring Côte Chalonnaise.
 await setup(page,{classification:null,wineName:'Rosé',region:'Côte Chalonnaise',appellation:'Bourgogne Côte Chalonnaise',colour:'Rosé',wineStyle:'rose'});
 await page.goto(route);await page.getByRole('button',{name:'View regional map'}).click();
 await expect(page.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
 await expect(page.locator('.village-map-context')).toHaveText('Regional denomination · 44 communes');
});

async function setup(page:Page,overrides:Record<string,unknown>={}){
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  // These fixtures have no active research run. Match the API contract rather
  // than returning a truthy list response as if it were a research status.
  if(path.endsWith('/deep-search-status'))return route.fulfill({status:404,json:{error:'No research run'}});
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

for(const route of matrixRoutes){
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

matrixTest('Santenay and Maranges use producer spellings and explain coincident boundaries',async({page})=>{
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

for(const route of matrixRoutes){
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

matrixTest('broad Premier Cru context does not claim a specific vineyard',async({page})=>{
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

test('compact Mâcon download retries without fetching the larger GeoJSON',async({page})=>{
 await setup(page,{appellation:'Mâcon',wineName:'Vieilles Vignes',classification:null});
 let available=false;
 const downloads:string[]=[];
 page.on('request',request=>{if(request.url().includes('/maps/'))downloads.push(request.url())});
 // Serve raw gzip on success to exercise native decompression too; Vite may
 // otherwise attach Content-Encoding and let fetch decompress automatically.
 await page.route('**/maps/macon.*.pbf.gz',route=>available
  ?route.fulfill({contentType:'application/gzip',path:'public/maps/macon.2026-09-21.overview.pbf.gz'})
  :route.fulfill({status:503,body:'Unavailable'}));
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View regional map'}).click();
 await expect(page.getByRole('alert')).toContainText('The map could not load');
 const attemptsBeforeRetry=downloads.length; // Development StrictMode may abort an initial request.
 expect(attemptsBeforeRetry).toBeGreaterThan(0);
 expect(downloads.every(url=>/\/macon\.[\d-]+\.overview\.pbf\.gz$/.test(url))).toBe(true);
 available=true;
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
 expect(downloads).toHaveLength(attemptsBeforeRetry+1);
 expect(downloads.every(url=>url.endsWith('.pbf.gz'))).toBe(true);
});

for(const [appellation,id] of [['Mâcon','macon'],['Mâcon-Villages','macon-villages']] as const)test(`${appellation} overview download survives 15 seconds, times out at 20 seconds, and retries`,async({page})=>{
 await page.clock.install({time:new Date('2026-09-27T12:00:00Z')});
 await setup(page,{appellation,wineName:'Vieilles Vignes',classification:null,colour:'White',wineStyle:'white'});
 let available=false,attempts=0;
 const downloads:string[]=[];
 page.on('request',request=>{if(request.url().includes('/maps/'))downloads.push(request.url())});
 await page.route(`**/maps/${id}.*.pbf.gz`,route=>{
  attempts++;
  // Leave the request pending until the dialog aborts it; no real-time sleep.
  if(available)return route.continue();
 });
 await page.goto('/shared/layout-wine');
 await expect(page.getByRole('heading',{name:'Vieilles Vignes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View regional map'}).click();
 await expect.poll(()=>attempts).toBeGreaterThan(0);
 // Let the lazy dialog mount before freezing its download timer.
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const dialog=page.getByRole('dialog',{name:appellation,exact:true});
 await page.clock.fastForward(15000);
 await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeDisabled();
 await expect(dialog.getByRole('alert')).toHaveCount(0);
 await page.clock.fastForward(6000);
 await expect(dialog.getByRole('alert')).toContainText('The map could not load');
 const attemptsBeforeRetry=attempts;
 available=true;
 await page.clock.resume();
 await dialog.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
 expect(attempts).toBe(attemptsBeforeRetry+1);
 expect(downloads.every(url=>url.endsWith(`/maps/${id}.2026-09-21.overview.pbf.gz`))).toBe(true);
});

const regionalMaps=JSON.parse(readFileSync('src/lib/places/burgundyRegionalMapRegistry.json','utf8')) as {maps:{id:string;name:string;wineColours:string[];productStyle?:string}[]};
// Region-wide Bourgogne maps stay built but the wine page offers none.
const compactNetworkCases=regionalMaps.maps.filter(m=>!unlistedRegionalMapIds.includes(m.id)).map(m=>[m.name,m.id,800000,20000] as const);
// Exercise the largest actual payload on every run. Byte equality/size checks
// cover every overview in unit tests; full throttled transfers run in the
// scheduled/manual matrix or explicitly for a map being introduced/reviewed.
const largestCompactId=[...compactNetworkCases].sort((a,b)=>statSync(`public/maps/${b[1]}.2026-09-21.overview.pbf.gz`).size-statSync(`public/maps/${a[1]}.2026-09-21.overview.pbf.gz`).size)[0][1];
const extraNetworkIds=(process.env.WINELOG_E2E_MAP_DOWNLOADS??'').split(',');
for(const [appellation,id,maxBytes,timeout] of compactNetworkCases.filter(([,id])=>fullMapMatrix||id===largestCompactId||extraNetworkIds.includes(id)))test(`${appellation} compact map loads over a 1 Mbps connection`,async({page,browserName},testInfo)=>{
 test.skip(browserName!=='chromium','Chromium network throttling');
 test.setTimeout(timeout+25000);
 const definition=regionalMaps.maps.find(m=>m.id===id)!;
 const sparkling='productStyle' in definition&&definition.productStyle==='sparkling';
 const colour=definition.wineColours[0];
 await setup(page,{appellation,wineName:'Vieilles Vignes',classification:null,colour,wineStyle:sparkling?'sparkling':colour,productSubtype:sparkling?'Sparkling':'Still'});
 await page.goto('/shared/layout-wine');
 // Warm the code, then close before measuring the boundary transfer. Browser
 // caching is disabled for the throttled load so the complete asset travels.
 await page.getByRole('button',{name:'View regional map'}).click();
 await expect(page.getByRole('button',{name:'Region view',exact:true})).toBeEnabled({timeout:id==='cremant-de-bourgogne'?15000:5000});
 await page.keyboard.press('Escape');
 const network=await page.context().newCDPSession(page);
 await network.send('Network.enable');
 await network.send('Network.setCacheDisabled',{cacheDisabled:true});
 await network.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:125000,uploadThroughput:62500});
 const compact=page.waitForResponse(response=>response.url().includes(`/maps/${id}.`)&&response.url().endsWith('.pbf.gz'),{timeout});
 const started=Date.now();
 await page.getByRole('button',{name:'View regional map'}).click();
 await expect(page.getByRole('button',{name:'Region view',exact:true})).toBeEnabled({timeout});
 const response=await compact;
 const sizes=await response.request().sizes();
 expect(sizes.responseBodySize).toBeLessThan(maxBytes);
 await testInfo.attach('compact-map-network',{body:JSON.stringify({downloadBytes:sizes.responseBodySize,readyAfterMs:Date.now()-started},null,2),contentType:'application/json'});
 await network.detach();
});

// Region-wide appellations cover most of Burgundy, so a highlight would not
// locate the wine: none of them, nor a reviewed alias or split label, offers a map.
for(const route of allMapRoutes)test(`Region-wide Bourgogne appellations ${route}: no map entry point`,async({page})=>{
 const downloads:string[]=[];
 page.on('request',r=>{if(r.url().includes('/maps/'))downloads.push(r.url())});
 for(const fields of [
  {appellation:'Bourgogne',wineName:'Les Graviers',colour:'White',wineStyle:'white',region:'Burgundy'},
  {appellation:'Bourgogne',wineName:'A cuvée',colour:'Red',wineStyle:'red',region:'Côte Chalonnaise'},
  {appellation:'Bourgogne Aligoté',wineName:'Vieilles Vignes',colour:'White',wineStyle:'white'},
  {appellation:'Bourgogne',wineName:'Aligoté',colour:'White',wineStyle:'white'},
  {appellation:'Bourgogne Passe-tout-grains',wineName:'Vieilles Vignes',colour:'Red',wineStyle:'red'},
  {appellation:'Bourgogne Rouge',wineName:'Passe-Tout-Grains',colour:'Red',wineStyle:'red'},
  {appellation:'Bourgogne Mousseux',wineName:'Vieilles Vignes',colour:'Red',wineStyle:'sparkling',productSubtype:'Sparkling'},
  {appellation:'Coteaux Bourguignons',wineName:'Vieilles Vignes',colour:'Red',wineStyle:'red'},
  {appellation:'Bourgogne Grand Ordinaire',wineName:'Les Champs',colour:'Rosé',wineStyle:'rose'},
  {appellation:'Crémant de Bourgogne',wineName:'Blanc de Noirs',colour:'White',wineStyle:'sparkling',productSubtype:'Sparkling'},
 ]){
  await setup(page,{classification:null,...fields});
  await page.goto(route);
  await expect(page.getByRole('heading',{name:fields.wineName,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/View (village|regional) map/})).toHaveCount(0);
 }
 expect(downloads).toEqual([]);
});

test('Mâcon-Villages: compact fallback without native gzip support',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(globalThis,'DecompressionStream',{value:undefined,configurable:true}));
 await setup(page,{appellation:'Mâcon-Villages',wineName:'AIGAICIA',classification:null,region:'Saône-et-Loire',colour:'White',wineStyle:'white'});
 const downloads:string[]=[];
 page.on('request',r=>{if(r.url().includes('/maps/'))downloads.push(r.url())});
 await page.goto('/shared/layout-wine');
 await page.getByRole('button',{name:'View regional map'}).click();
 await expect(page.getByRole('button',{name:'Region view',exact:true})).toBeEnabled({timeout:15000});
 expect([...new Set(downloads)]).toEqual([new URL('/maps/macon-villages.2026-09-21.overview.pbf',page.url()).href]);
});

for(const route of allMapRoutes)test(`Bourgogne review labels ${route}: Clairet, separate AOCs and region scope`,async({page})=>{
 await page.setViewportSize({width:320,height:900});
 for(const [appellation,wineName,region,colour,expected] of ([
  ['Bourgogne Clairet','Montrecul','Côte d’Or','rose','Bourgogne Montrecul'],
  ['Mâcon Lugny','Chardonnay avec Aligoté','Burgundy','white','Mâcon Lugny'],
 ] as const).filter((_,index)=>fullMapMatrix||index===0)){
  await setup(page,{appellation,wineName,region,colour,wineStyle:colour,classification:null});
  await page.goto(route);
  await page.getByRole('button',{name:'View regional map'}).click();
  const dialog=page.getByRole('dialog',{name:expected,exact:true});
  await expect(dialog.getByRole('button',{name:'Region view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('heading',{name:expected,exact:true})).toHaveCount(2);
  await page.keyboard.press('Escape');
 }
 for(const [appellation,wineName,region,colour] of [
  ['Bourgogne','Kimméridgien','Chablis','white'],
  ['Bourgogne Blanc Vieilles Vignes','Bourgogne-Aligoté','Burgundy','white'],
  ['Bourgogne Rosé Vieilles Vignes','Passe-tous-grains','Burgundy','rose'],
  ['Bourgogne Rouge Vieilles Vignes','Aligoté','Burgundy','red'],
  ['Bourgogne Hautes Côtes de Nuits','Aligoté','Burgundy','white'],
  ['Bourgogne Vieilles Vignes','Aligoté Bouzeron','Burgundy','white'],
  ['Bourgogne Blanc','Passe-Tout-Grains','Burgundy','white'],
  ['Mâcon','Passetoutgrains','Burgundy','red'],
  ['Bourgogne Clairet','Montrecul','Côte d’Or','red'],
  ['Bourgogne Chitry','Olympe','Chablis','white'],
 ] as const){
  await setup(page,{appellation,wineName,region,colour,wineStyle:colour,classification:null});
  await page.goto(route);
  await expect(page.getByRole('heading',{name:wineName,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View regional map'})).toHaveCount(0);
 }
});

matrixTest('conflicting wine identities do not show a map entry point',async({page})=>{
 await setup(page,{identityMatchStatus:'conflict'});await page.goto('/wines/layout-wine');
 await expect(page.getByRole('heading',{name:'Les Cazetiers',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
});

for(const village of [
 {id:'morey-saint-denis',name:'Morey-Saint-Denis',cru:'Les Ruchots',featureId:'inao-denom-946',count:41,catalogue:'moreyVillageMapCatalogue',namedPlots:['clos-des-lambrays','clos-saint-denis','clos-de-la-roche']},
 {id:'chambolle-musigny',name:'Chambolle-Musigny',cru:'Les Amoureuses',featureId:'inao-denom-455',count:30,catalogue:'chambolleVillageMapCatalogue',namedPlots:['musigny']},
].filter(village=>fullMapMatrix||village.id==='morey-saint-denis')){
 for(const route of matrixRoutes){
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
   // Only this village's map and the named-area layers of its reviewed crus load.
   expect([...new Set(requests.filter(url=>url.includes('/maps/')).map(url=>new URL(url).pathname.split('.')[0]))].sort())
    .toEqual([`/maps/${village.id}`,...village.namedPlots.map(slug=>`/maps/${slug}-named-plots`)].sort());
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

matrixTest('Bonnes-Mares opens in Chambolle with both producing communes explained',async({page})=>{
 await setup(page,{appellation:'Bonnes-Mares',wineName:'Bonnes-Mares',classification:'grand_cru'});
 await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Chambolle-Musigny',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-361');
 await expect(dialog.locator('.village-map-overlap')).toContainText('does not identify which side');
});

const villageMapCases=[
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
] as const;
const smokeVillageIds=new Set<string>([
 'marsannay',
 'meursault',
 'pouilly-fuisse',
]);
const browserVillageCases=fullMapMatrix?villageMapCases:villageMapCases.filter(village=>smokeVillageIds.has(village.id));

for(const village of browserVillageCases){
 for(const route of matrixRoutes){
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
   const mapDownloads=requests.filter(url=>url.includes('/maps/')),compressedUrl=losslessMaps[village.id]?.brotliJsonUrl;
   expect(mapDownloads.length).toBeGreaterThan(0);
   expect(mapDownloads.every(url=>compressedUrl?url.endsWith(compressedUrl):url.includes(`/maps/${village.id}.`))).toBe(true);
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

for(const route of matrixRoutes){
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

matrixTest('Ferret vineyard location requires unambiguous producer evidence for Le Clos',async({page})=>{
 for(const row of [
  {producer:null,wineName:'Le Clos',id:'inao-denom-2865'},
  {producer:'Château Fuissé',wineName:'Domaine Ferret Le Clos',id:'inao-denom-2865'},
  {producer:'Domaine Ferret',wineName:'Le Clos et Les Crays',id:'inao-denom-2865'},
  {producer:'Château Fuissé',wineName:'Le Clos',id:'inao-denom-2870'},
  {producer:'Domaine Vincent',wineName:'Le Clos',id:'inao-denom-2870'},
  {producer:'Domaine Vincent Cornin',wineName:'Le Clos',id:'inao-denom-2865'},
  {producer:null,wineName:'Domaine Vincent Cornin Pouilly-Fuissé Le Clos',id:'inao-denom-2865'},
 ].filter((_,index)=>fullMapMatrix||[0,3,5].includes(index))){
  await setup(page,{...row,appellation:'Pouilly-Fuissé',colour:'White',wineStyle:'white'});
  await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(row.id);
  await expect(dialog.getByRole('link',{name:'Producer’s explanation'})).toHaveCount(0);
  await page.keyboard.press('Escape');
 }
});

matrixTest('Mâconnais local Premier Cru maps keep village Atlas links separate',async({page})=>{
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

matrixTest('Pouilly-Fuissé producer subdivisions select their full official climat',async({page})=>{
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

matrixTest('Saint-Véran area controls and Viré-Clessé climat area retain broad scope',async({page},testInfo)=>{
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

matrixTest('Mâconnais white-only maps reject colour and unsupported tier conflicts',async({page})=>{
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

matrixTest('white-only Chalonnaise appellations reject incompatible colour and Bouzeron Premier Cru',async({page})=>{
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
 ].filter((_,index)=>fullMapMatrix||index<3)){
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
].filter(village=>fullMapMatrix||['Meursault','Chorey-lès-Beaune','Maranges'].includes(village.name))){
 matrixTest(`${village.name} colour selects the official area and unknown colour keeps a combined overview`,async({page})=>{
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

for(const grand of [{name:'Montrachet',id:927},{name:'Bâtard-Montrachet',id:273}].filter(grand=>fullMapMatrix||grand.name==='Montrachet')){
 test(`${grand.name} opens its full shared boundary in Puligny`,async({page})=>{
  await setup(page,{appellation:grand.name,wineName:grand.name,classification:'grand_cru',colour:'White',wineStyle:'white'});
  await page.goto('/wines/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:'Puligny-Montrachet',exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(`inao-denom-${grand.id}`);
  await expect(dialog.locator('.village-map-overlap')).toContainText('Puligny-Montrachet and Chassagne-Montrachet');
 });
}

matrixTest('a white Blagny record does not select the red appellation boundary',async({page})=>{
 await setup(page,{appellation:'Blagny',wineName:'La Pièce sous le Bois',colour:'White',wineStyle:'white'});
 await page.goto('/wines/layout-wine');
 await expect(page.getByRole('heading',{name:'La Pièce sous le Bois',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
});

for(const route of matrixRoutes){
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

matrixTest('Corton broad, mixed, unsupported and white records keep appellation scope',async({page})=>{
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
 ].filter((_,index)=>fullMapMatrix||[0,6].includes(index))){
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

matrixTest('Beaune and Volnay label spellings select the reviewed cru',async({page})=>{
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
 ].filter((_,index)=>fullMapMatrix||[0,5,8].includes(index))){
  await setup(page,{appellation,wineName,colour});await page.goto('/wines/layout-wine');
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('combobox')).toHaveValue(id);
  await page.keyboard.press('Escape');
 }
});

matrixTest('a red Meursault Santenots opens Volnay Santenots with the explanation',async({page})=>{
 await setup(page,{appellation:'Meursault',wineName:'Santenots',colour:'Red'});await page.goto('/wines/layout-wine');
 await page.getByRole('button',{name:'View village map'}).click();
 const dialog=page.getByRole('dialog',{name:'Volnay',exact:true});
 await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 await expect(dialog.getByRole('combobox')).toHaveValue('inao-denom-1259');
 await expect(dialog.locator('.village-map-overlap')).toContainText('a red wine recorded as Meursault Santenots is shown here');
});

matrixTest('Savigny, Auxey and Monthélie producer spellings select the reviewed cru',async({page})=>{
 for(const [appellation,wineName,id,selected,note] of [
  ['Savigny-lès-Beaune','Albert Morot La Bataillère aux Vergelesses Premier Cru','inao-denom-1180','Bataillère','separate from Les Vergelesses'],
  ['Auxey-Duresses','Les Bretterins','inao-denom-267','Les Bréterins',''],
  ['Auxey-Duresses','Les Ecusseaux','inao-denom-269','Les Ecussaux',''],
  ['Auxey-Duresses','Les Bretterins dit La Chapelle','inao-denom-266','La Chapelle','is shown as La Chapelle'],
  ['Monthélie','MJ Tricot Clos Les Champs Fulliot','inao-denom-921','Les Champs Fulliots','whole Les Champs Fulliots Premier Cru'],
 ].filter((_,index)=>fullMapMatrix||[0,1,4].includes(index))){
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

matrixTest('Chorey and Saint-Romain explain missing plot boundaries and reject a Premier Cru tier',async({page})=>{
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

matrixTest('white Pommard and Volnay records do not select a red-wine map',async({page})=>{
 for(const [appellation,wineName] of [['Pommard','Clos Blanc'],['Volnay','Santenots']]){
  await setup(page,{appellation,wineName,colour:'White',wineStyle:'white'});await page.goto('/wines/layout-wine');
  await expect(page.getByRole('heading',{name:wineName,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View village map'})).toHaveCount(0);
 }
});

for(const route of matrixRoutes){
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
  await expect(selector.locator('optgroup:not([label$=" · cadastral named areas"]) option')).toHaveCount(24);
  await expect(selector.locator('optgroup[label="Échezeaux · cadastral named areas"] option')).toHaveCount(10);
  await expect(selector.locator('optgroup[label="Richebourg · cadastral named areas"] option')).toHaveCount(2);
  await expect(selector.locator('option')).toHaveCount(36);
  await expect(dialog.locator('.village-map-selected-label')).toHaveText('Les Petits Monts');
  await expect(dialog.locator('.village-map-context')).toContainText('8 Grand Crus · 14 Premier Cru climats');
  await expect(dialog.locator('.village-map-context')).toContainText('Vosne-Romanée & Flagey-Échezeaux');
  const catalogues=requests.filter(url=>url.includes('VillageMapCatalogue.json'));
  const boundaries=requests.filter(url=>url.includes('/maps/'));
  expect(catalogues.length).toBeGreaterThan(0);expect(boundaries.length).toBeGreaterThan(0);
  expect(catalogues.every(url=>url.includes('vosneVillageMapCatalogue'))).toBe(true);
  expect([...new Set(boundaries.map(url=>new URL(url).pathname.split('.')[0]))].sort()).toEqual(['/maps/echezeaux-named-plots','/maps/richebourg-named-plots','/maps/vosne-romanee']);
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
 matrixTest(`${grand.name}: opens its distinct Grand Cru in the Vosne and Flagey map`,async({page})=>{
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

const detailedDownloadCases=[
 ['Chablis','chablis','White','Chablis'],
 ['Côte de Beaune-Villages','cote-de-beaune-villages','Red','Côte de Beaune'],
 ['Petit Chablis','petit-chablis','White','Chablis'],
 ['Pouilly-Fuissé','pouilly-fuisse','White','Mâconnais'],
 ['Meursault','meursault','White','Côte de Beaune'],
 ['Santenay','santenay','Red','Côte de Beaune'],
 ['Marsannay','marsannay','Red','Côte de Nuits'],
 ['Beaune','beaune','Red','Côte de Beaune'],
 ['Montagny','montagny','White','Côte Chalonnaise'],
 ['Saint-Aubin','saint-aubin','White','Côte de Beaune'],
 ['Savigny-lès-Beaune','savigny-les-beaune','Red','Côte de Beaune'],
 ['Viré-Clessé','vire-clesse','White','Mâconnais'],
 ['Givry','givry','Red','Côte Chalonnaise'],
 ['Chassagne-Montrachet','chassagne-montrachet','White','Côte de Beaune'],
] as const;
// Keep the pilot's cases and the largest new gzip/Brotli cases in routine CI.
// Every asset still has exact unit/runtime checks; scheduled/manual CI expands
// both the HTTP-decoded journeys and network checks to the entire registry.
const routineDetailedIds=new Set<string>(['chablis','cote-de-beaune-villages','petit-chablis','pouilly-fuisse','meursault','montagny']);
if(Object.keys(losslessMaps).some(id=>!detailedDownloadCases.some(([,caseId])=>caseId===id)))throw new Error('Missing lossless map browser case');
for(const [appellation,id,colour,region] of detailedDownloadCases.filter(([,id])=>fullMapMatrix||routineDetailedIds.has(id)))for(const route of allMapRoutes){
 test(`Lossless detailed ${appellation} ${route}: exact HTTP-decoded map`,async({page})=>{
  await setup(page,{appellation,region,colour,wineStyle:colour.toLowerCase(),wineName:'Vieilles Vignes',classification:null});
  const downloads:string[]=[];page.on('request',r=>{if(r.url().includes('/maps/'))downloads.push(r.url())});
  await page.goto(route);expect(downloads).toEqual([]);
  const url=losslessMaps[id].brotliJsonUrl;
  const pending=page.waitForResponse(r=>r.url().endsWith(url));
  await page.getByRole('button',{name:'View village map'}).click();
  const dialog=page.getByRole('dialog',{name:appellation,exact:true});
  await expect(dialog.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
  const response=await pending;
  expect(response.headers()['content-encoding']).toBe('br');
  expect(response.headers()['cache-control']).toContain('immutable');
  const manifest=JSON.parse(readFileSync('scripts/burgundy-lossless-map-report.json','utf8')) as {maps:{id:string;sourceSha256:string}[]};
  expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(manifest.maps.find(m=>m.id===id)!.sourceSha256);
  expect([...new Set(downloads)]).toEqual([new URL(url,page.url()).href]);
  await expect(dialog.locator('.village-map-overview-note')).toHaveCount(0);
 });
}

test('Lossless detailed map: older browsers use HTTP gzip and retry keeps the same small asset',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(globalThis,'DecompressionStream',{configurable:true,value:undefined}));
 await setup(page,{appellation:'Chablis',region:'Chablis',colour:'White',wineStyle:'white',wineName:'Vieilles Vignes',classification:null});
 const url=losslessMaps.chablis.gzipJsonUrl,downloads:string[]=[];
 page.on('request',r=>{if(r.url().includes('/maps/'))downloads.push(r.url())});
 let available=false;
 await page.route('**'+url,r=>available?r.continue():r.fulfill({status:503,body:'Unavailable'}));
 await page.goto('/shared/layout-wine');await page.getByRole('button',{name:'View village map'}).click();
 await expect(page.getByRole('alert')).toContainText('The map could not load');
 available=true;
 const pending=page.waitForResponse(r=>r.url().endsWith(url)&&r.status()===200);
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
 expect((await pending).headers()['content-encoding']).toBe('gzip');
 expect([...new Set(downloads)]).toEqual([new URL(url,page.url()).href]);
});

for(const modern of [true,false]){
 const key=modern?'brotliJsonUrl':'gzipJsonUrl';
 const largest=[...detailedDownloadCases].sort((a,b)=>statSync('public'+losslessMaps[b[1]][key]).size-statSync('public'+losslessMaps[a[1]][key]).size)[0][1];
 for(const [appellation,id,colour,region] of detailedDownloadCases.filter(([,id])=>fullMapMatrix||id===largest)){
  test(`Lossless detailed ${appellation}: ${modern?'Brotli':'legacy gzip'} at 1 Mbps`,async({page,browserName},testInfo)=>{
   test.skip(browserName!=='chromium','Chromium network throttling');
   if(!modern)await page.addInitScript(()=>Object.defineProperty(globalThis,'DecompressionStream',{configurable:true,value:undefined}));
   await setup(page,{appellation,region,colour,wineStyle:colour.toLowerCase(),wineName:'Vieilles Vignes',classification:null});
   await page.goto('/shared/layout-wine');
   await page.getByRole('button',{name:'View village map'}).click();
   await expect(page.getByRole('button',{name:'Village view',exact:true})).toBeEnabled();
   await page.keyboard.press('Escape');
   const network=await page.context().newCDPSession(page);
   await network.send('Network.enable');await network.send('Network.setCacheDisabled',{cacheDisabled:true});
   await network.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:125000,uploadThroughput:62500});
   const url=losslessMaps[id][key],pending=page.waitForResponse(r=>r.url().endsWith(url));
   const started=Date.now();await page.getByRole('button',{name:'View village map'}).click();
   await expect(page.getByRole('button',{name:'Village view',exact:true})).toBeEnabled({timeout:20000});
   const response=await pending,sizes=await response.request().sizes();
   expect(sizes.responseBodySize).toBe(statSync('public'+url).size);
   expect(sizes.responseBodySize).toBeLessThan(modern?600000:950000);
   await testInfo.attach('lossless-map-network',{body:JSON.stringify({encoding:modern?'br':'gzip',downloadBytes:sizes.responseBodySize,readyAfterMs:Date.now()-started}),contentType:'application/json'});
   await network.detach();
  });
 }
}

test('Lossless detailed asset is reused from the browser cache',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Chromium cache instrumentation');
 // No request routing: Playwright routing disables the browser HTTP cache.
 await page.goto('/login');
 const network=await page.context().newCDPSession(page);await network.send('Network.enable');
 await network.send('Network.setCacheDisabled',{cacheDisabled:false});
 const requests=new Set<string>(),hits=new Set<string>(),url=losslessMaps.chablis.brotliJsonUrl;
 network.on('Network.requestWillBeSent',e=>{if(e.request.url.endsWith(url))requests.add(e.requestId)});
 network.on('Network.requestServedFromCache',e=>{if(requests.has(e.requestId))hits.add(e.requestId)});
 network.on('Network.responseReceived',e=>{if(e.response.url.endsWith(url)&&e.response.fromDiskCache)hits.add(e.requestId)});
 const read=()=>page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,length:(await r.arrayBuffer()).byteLength}},url);
 const first=await read(),second=await read();expect(second).toEqual(first);expect(first.status).toBe(200);
 await expect.poll(()=>hits.size).toBeGreaterThan(0);await network.detach();
});
