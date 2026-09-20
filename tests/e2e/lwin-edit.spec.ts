import { test,expect,type Page } from '@playwright/test';
import { wine as base } from './fixtures/layoutWine';

const reference={source:'lwin',version:'2026-09-18',lwin7:'1234567',displayName:'Domaine Example, Les Vergelesses, Savigny-lès-Beaune Premier Cru',producer:'Domaine Example',wineName:'Les Vergelesses',country:'France',region:'Burgundy',subRegion:'Côte de Beaune',site:'Les Vergelesses',parcel:null,designation:'AOP',classification:'Premier Cru',colour:'White',productType:'Wine',productSubtype:'Still',vintageConfig:'sequential',firstVintage:2000,finalVintage:2025,sourceUpdatedAt:'2026-09-18',method:'deterministic',confidence:1,filled:{},conflicts:[]};
async function setup(page:Page,overrides:Record<string,unknown>={},role='owner'){
 let wine:Record<string,unknown>={...base,id:'w1',lwinReference:reference,identityMatchCandidates:[],referenceSuggestions:[],tastingNotes:'Keep my note',...overrides};
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
 await expect(page.getByRole('heading',{name:'LWIN match',exact:true})).toBeVisible();
 return {actions,saves};
}

for(const width of [393,1280])test(`LWIN fields, explicit differences and saved edits at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:852});
 const {saves,actions}=await setup(page,{country:null,region:'My region'});
 await expect(page.getByRole('status').filter({hasText:/^Matched$/})).toBeVisible();
 await page.getByText('Catalogue details · region, vineyard & classification',{exact:true}).click();
 await expect(page.getByLabel('LWIN Sub-region',{exact:true})).toHaveValue('Côte de Beaune');
 await expect(page.getByLabel('LWIN Designation',{exact:true})).toHaveValue('AOP');
 await expect(page.getByLabel('LWIN Colour',{exact:true})).toHaveAttribute('readonly','');
 await page.getByRole('button',{name:'Fill 1 missing field',exact:true}).click();
 await expect(page.locator('input[name=country]')).toHaveValue('France');
 await expect(page.locator('input[name=region]')).toHaveValue('My region');
 await page.getByRole('button',{name:'Use LWIN region',exact:true}).click();
 await expect(page.locator('input[name=region]')).toHaveValue('Burgundy');
 await expect(page.getByRole('button',{name:'Refresh match and details'})).toBeDisabled();
 await page.getByRole('link',{name:'Tasting & notes',exact:true}).click();
 await page.getByRole('textbox',{name:'Tasting notes',exact:true}).fill('New personal note');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'LWIN match',exact:true}).click();
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
});

test('members can see the match and facts without owner matching controls',async({page})=>{
 await setup(page,{},'member');
 await expect(page.getByText('Matched',{exact:true})).toBeVisible();
 await expect(page.getByLabel('LWIN Sub-region',{exact:true})).toHaveValue('Côte de Beaune');
 await expect(page.getByRole('button',{name:/Refresh match|Reject match|Use LWIN/})).toHaveCount(0);
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
