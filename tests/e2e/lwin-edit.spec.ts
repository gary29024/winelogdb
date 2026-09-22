import { test,expect,type Page } from '@playwright/test';
import { wine as base } from './fixtures/layoutWine';

const reference={source:'lwin',version:'2026-09-18',lwin7:'1234567',displayName:'Domaine Example, Les Vergelesses, Savigny-lès-Beaune Premier Cru',producer:'Domaine Example',wineName:'Les Vergelesses',country:'France',region:'Burgundy',subRegion:'Côte de Beaune',site:'Les Vergelesses',parcel:null,designation:'AOP',classification:'Premier Cru',colour:'White',productType:'Wine',productSubtype:'Still',vintageConfig:'sequential',firstVintage:2000,finalVintage:2025,sourceUpdatedAt:'2026-09-18',method:'deterministic',confidence:1,filled:{},conflicts:[]};
async function setup(page:Page,overrides:Record<string,unknown>={},role='owner',expand=true){
 let wine:Record<string,unknown>={...base,id:'w1',productType:'Wine',referenceSite:reference.site,lwinReference:reference,identityMatchCandidates:[],referenceSuggestions:[],tastingNotes:'Keep my note',...overrides};
 const actions:Record<string,unknown>[]=[],saves:Record<string,unknown>[]=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:role,role,email:'test@example.com',display_name:'Reader',status:'active'}}});
  if(path==='/api/wines/w1'){
   if(request.method()==='PUT'){const input=request.postDataJSON();saves.push(input);wine={...wine,...input};return route.fulfill({json:{ok:true}})}
   return route.fulfill({json:wine});
  }
  if(path==='/api/wines/w1/reference-preview')return route.fulfill({json:{requestedLwin7:url.searchParams.get('lwin7'),lwin7:'1234567',storedLwin7:wine.lwin7,displayName:reference.displayName,producer:reference.producer,wineName:reference.wineName,country:reference.country,region:reference.region,colour:'White',productType:'Wine',productSubtype:'Still',lwin11:'12345672020',vintage:2020,suggestions:[],previewToken:'checked-preview'}});
  if(path==='/api/wines/w1/reference-review'){
   const action=request.postDataJSON();actions.push(action);
   wine=action.action==='reject'?{...wine,lwin7:null,lwin11:null,lwinReference:null,identityMatchStatus:'manual'}:{...wine,lwin7:'1234567',lwin11:'12345672020',lwinReference:reference,identityMatchCandidates:[],identityMatchStatus:action.action==='link'?'manual':'matched',country:wine.country||'France',region:wine.region||'Burgundy'};
   return route.fulfill({json:{ok:true}});
  }
  return route.fulfill({json:{items:[],holdings:[],total:0,matched:false,tasting:null}});
 });
 await page.goto('/wines/w1/edit');
 if(role==='member'){
  // Members get the catalogue read back through the wine fields and the facts
  // list; the matching panel itself is owner work and is not rendered for them.
  await expect(page.locator('.wine-enriched-details')).toBeVisible();
  await expect(page.getByText('LWIN reference',{exact:true})).toHaveCount(0);
  return {actions,saves};
 }
 await expect(page.getByText('LWIN reference',{exact:true})).toBeVisible();
 if(expand)await page.getByText('LWIN reference',{exact:true}).click();
 return {actions,saves};
}

for(const width of [393,1280])test(`LWIN fields, explicit differences and saved edits at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:852});
 const {saves,actions}=await setup(page,{country:null,region:'My region'});
 await expect(page.getByRole('status').filter({hasText:/^Matched$/})).toBeVisible();
 await page.getByText('Original catalogue details',{exact:true}).click();
 await expect(page.locator('.lwin-edit-fact-grid')).toContainText('Côte de Beaune');
 await expect(page.locator('.lwin-edit-fact-grid')).toContainText('AOP');
 await expect(page.locator('.wine-enriched-details')).toContainText('White');
 await page.getByRole('button',{name:'Fill 1 missing field',exact:true}).click();
 await expect(page.locator('input[name=country]')).toHaveValue('France');
 await expect(page.locator('input[name=region]')).toHaveValue('My region');
 await page.getByRole('button',{name:'Use LWIN region',exact:true}).click();
 await expect(page.locator('input[name=region]')).toHaveValue('Burgundy');
 await expect(page.getByRole('button',{name:'Refresh match and details'})).toBeDisabled();
 await page.getByRole('textbox',{name:'Tasting notes',exact:true}).fill('New personal note');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByText('LWIN reference',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath(`lwin-edit-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page).toHaveURL(/\/wines\/w1$/);
 expect(saves).toHaveLength(1);expect(saves[0]).toMatchObject({country:'France',region:'Burgundy',tastingNotes:'New personal note'});
 expect(saves[0]).not.toHaveProperty('lwinReference');expect(actions).toHaveLength(0);
});

test('ambiguous candidates require preview and explicit link, then fill missing fields',async({page})=>{
 const {actions}=await setup(page,{lwin7:null,lwin11:null,lwinReference:null,country:null,identityMatchStatus:'ambiguous',identityMatchCandidates:['1234567','7654321']});
 await expect(page.getByText('Multiple possible matches',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Preview LWIN 1234567',exact:true}).click();
 await expect(page.getByRole('region',{name:'LWIN preview'})).toBeVisible();expect(actions).toHaveLength(0);
 await page.getByRole('button',{name:'Link LWIN 1234567',exact:true}).click();
 await expect(page.getByText('Manually linked',{exact:true})).toBeVisible();
 await expect(page.locator('input[name=country]')).toHaveValue('France');
 await expect(page.getByRole('textbox',{name:'Tasting notes',exact:true})).toHaveValue('Keep my note');
 expect(actions).toEqual([{action:'link',lwin7:'1234567',previewToken:'checked-preview'}]);
});

test('save and continue keeps the edit page, and recheck preserves new notes',async({page})=>{
 const {saves,actions}=await setup(page,{lwin7:null,lwin11:null,lwinReference:null,identityMatchStatus:'unmatched'});
 await page.getByRole('textbox',{name:'Tasting notes',exact:true}).fill('Unsaved note');
 await expect(page.getByRole('button',{name:'Find LWIN match',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Save & continue matching',exact:true}).click();
 await expect(page).toHaveURL(/\/wines\/w1\/edit$/);
 await expect(page.getByRole('button',{name:'Find LWIN match',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Find LWIN match',exact:true}).click();
 await expect(page.getByText('Matched',{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Tasting notes',exact:true})).toHaveValue('Unsaved note');
 expect(saves).toHaveLength(1);expect(actions).toEqual([{action:'recheck'}]);
});

test('failed matching keeps the form available and reports the failure',async({page})=>{
 await setup(page);
 await page.route('**/api/wines/w1/reference-review',route=>route.fulfill({status:503,json:{error:'Catalogue unavailable'}}));
 await page.getByRole('button',{name:'Refresh match and details'}).click();
 await expect(page.getByRole('alert')).toContainText('Catalogue unavailable');
 await expect(page.getByRole('textbox',{name:'Tasting notes',exact:true})).toBeEnabled();
 await expect(page.getByRole('textbox',{name:'Tasting notes',exact:true})).toHaveValue('Keep my note');
});

test('conflicts cannot fill fields until the stored match is reviewed',async({page})=>{
 await setup(page,{identityMatchStatus:'conflict',country:null});
 await expect(page.getByText('Needs review',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Fill .*missing|Use LWIN/})).toHaveCount(0);
 await expect(page.locator('.wine-enriched-details')).not.toContainText('Côte de Beaune');
});

for(const width of [393,1280])test(`compact reference keeps enriched wine details in the form at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:852});
 await setup(page,{},'owner',false);
 const panel=page.locator('#lwin-match');
 await expect(panel).not.toHaveAttribute('open','');
 expect((await panel.boundingBox())!.height).toBeLessThan(90);
 await expect(page.getByText('Matched',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Refresh match and details'})).not.toBeVisible();
 await expect(page.locator('input[name=country]')).toHaveValue('France');
 await expect(page.locator('input[name=region]')).toHaveValue('Burgundy');
 await expect(page.locator('select[name=classificationOverride] option:checked')).toHaveText('Premier Cru (automatic)');
 const details=page.locator('.wine-enriched-details');
 await expect(details).toContainText('White');await expect(details).toContainText('Wine');await expect(details).toContainText('Still');
 await expect(details).toContainText('Côte de Beaune');await expect(details).toContainText('Les Vergelesses');
 await expect(details).not.toContainText('Not provided');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`compact-lwin-${width}.png`),fullPage:true});
});

test('main form shows saved values rather than conflicting catalogue values',async({page})=>{
 await setup(page,{colour:'Red',productSubtype:'Sparkling'},'owner',false);
 const details=page.locator('.wine-enriched-details');
 await expect(details).toContainText('Red');await expect(details).toContainText('Sparkling');
 await expect(details).not.toContainText('White');await expect(details).not.toContainText('Still');
 await page.getByText('LWIN reference',{exact:true}).click();
 await page.getByText('Original catalogue details',{exact:true}).click();
 await expect(page.locator('.lwin-edit-fact-grid')).toContainText('White');
});

test('legacy backfilled values remain visible without a newer reference snapshot',async({page})=>{
 await setup(page,{lwinReference:null,referenceSite:'Saved vineyard'},'owner',false);
 const details=page.locator('.wine-enriched-details');
 await expect(details).toContainText('White');await expect(details).toContainText('Still');
 await expect(details).toContainText('Saved vineyard');
 await expect(details).not.toContainText('Côte de Beaune');
});

test('members see the catalogue facts without the matching panel or its controls',async({page})=>{
 await setup(page,{},'member');
 await expect(page.locator('.wine-enriched-details')).toContainText('Côte de Beaune');
 await expect(page.locator('#lwin-match')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Refresh match|Reject match|Use LWIN/})).toHaveCount(0);
 // The simplified view drops the owner diagnostics from the fields as well.
 await expect(page.locator('select[name=classificationOverride] option:checked')).toHaveText('Auto - read from label');
 await expect(page.locator('.wine-compact-row.appellation-row small')).toHaveCount(0);
});

test('manual opt-out is visible and offers only an explicit link',async({page})=>{
 await setup(page,{lwin7:null,lwin11:null,lwinReference:null,elid:null,identityMatchStatus:'manual'});
 await expect(page.getByText('Matching turned off',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Find LWIN match',exact:true})).toHaveCount(0);
 await page.getByText('Link a LWIN',{exact:true}).click();
 await expect(page.getByLabel('LWIN code',{exact:true})).toBeVisible();
});

test('a manual cru override changes only after explicitly choosing the LWIN value',async({page})=>{
 const {saves}=await setup(page,{classificationOverride:'grand_cru'});
 await expect(page.locator('select[name=classificationOverride]')).toHaveValue('grand_cru');
 await page.getByRole('button',{name:'Use LWIN cru level',exact:true}).click();
 await expect(page.locator('select[name=classificationOverride]')).toHaveValue('');
 await page.getByRole('button',{name:'Save & continue matching',exact:true}).click();
 await expect(page.getByRole('button',{name:'Refresh match and details'})).toBeEnabled();
 expect(saves[0]).toMatchObject({classification:'premier_cru',classificationOverride:null});
});

test('structure buttons count as unsaved edits before a reference refresh',async({page})=>{
 await setup(page);
 await page.locator('.structure-disclosure > summary').click();
 await page.getByRole('group',{name:'Acidity',exact:true}).getByRole('button',{name:'High',exact:true}).click();
 await expect(page.getByRole('button',{name:'Refresh match and details'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Save & continue matching'})).toBeVisible();
});
