import { test,expect } from '@playwright/test';
const fixture={
 id:'layout-wine',producer:'Domaine Example',wineName:'Savigny-lès-Beaune Premier Cru Les Vergelesses',
 vintage:2020,country:'France',region:'Burgundy',appellation:'Savigny-lès-Beaune',
 classification:'premier_cru',wineStyle:'white',colour:'White',productSubtype:'Still',
 grapes:['Chardonnay'],grapeBlend:[{grape:'Chardonnay',percentage:100}],alcoholPercentage:13,
 lwin7:'1234567',lwin11:'12345672020',elid:'FR-EXAMPLE-2020',
 referenceSite:'Hill above the village',referenceParcel:null,identityMatchStatus:'matched',
 favorite:false,producerId:null,tags:[],imageIds:[],photos:[],groupSourcePhotos:[],
 tastingNotes:'',rating:null,tastingDate:null,price:null,currency:null,
 tastingName:null,venue:null,locationName:null,sparklingDetails:null,ownerName:'Alex',
 createdAt:'2026-09-20T00:00:00Z',updatedAt:'2026-09-20T00:00:00Z',
 deepSearch:{summary:'A fresh, mineral white wine.',drinkingWindow:'Enjoy from 2026 to 2032.',
  vintageQuality:'',producerDetails:'',producerWinemakingPractices:'',winemakingTechniques:'',
  terroir:'',sources:[],researchedAt:'2026-09-20T00:00:00Z'}
};


test.use({viewport:{width:393,height:852}});
test('matched LWIN is visible and can be checked without entering its code',async({page})=>{
 const displayName='Guy Amiot et Fils, Chassagne-Montrachet Premier Cru, Clos Saint-Jean Rouge';
 const wine={...fixture,id:'w1',producer:'Guy Amiot et Fils',wineName:'Chassagne-Montrachet 1er Cru Clos Saint Jean',lwin7:'1018031',imageIds:[],lwinReference:{lwin7:'1018031',displayName},referenceSuggestions:[{field:'wineName',label:'Wine name',current:'Chassagne-Montrachet 1er Cru Clos Saint Jean',suggested:'Chassagne-Montrachet Premier Cru, Clos Saint-Jean Rouge'}]};
 let previews=0,writes=0;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(route.request().method()!=='GET')writes++;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/rollout/lwin-review')return route.fulfill({json:{items:[wine],total:1,nextCursor:null}});
  if(path==='/api/wines/w1')return route.fulfill({json:wine});
  if(path==='/api/wines/w1/reference-preview'){
   expect(url.searchParams.get('lwin7')).toBe('1018031');previews++;
   return route.fulfill({json:{requestedLwin7:'1018031',lwin7:'1018031',storedLwin7:'1018031',displayName,suggestions:wine.referenceSuggestions,previewToken:'preview'}});
  }
  return route.fulfill({json:{items:[],total:0}});
 });
 await page.goto('/admin/lwin-review?wine=w1');
 const stored=page.getByRole('region',{name:'Stored LWIN reference'});
 await expect(stored.getByText('Stored LWIN 1018031',{exact:true})).toBeVisible();
 await expect(stored.getByText(displayName,{exact:true})).toBeVisible();
 await stored.getByRole('button',{name:'Check LWIN 1018031'}).click();
 await expect(page.getByRole('region',{name:'LWIN preview'}).getByText(displayName,{exact:true})).toBeVisible();
 expect(previews).toBe(1);expect(writes).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('members have no catalogue maintenance on wine details',async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'member',role:'member',email:'member@example.com',display_name:'Member',status:'active'}}});
  if(path==='/api/wines/w1')return route.fulfill({json:{...fixture,id:'w1',identityMatchStatus:'conflict',referenceSuggestions:[{field:'producer',label:'Producer',current:'Example',suggested:'Other'}]}});
  if(path.endsWith('/research-status'))return route.fulfill({status:404,json:{error:'No run'}});
  return route.fulfill({json:{items:[],holdings:[],total:0}});
 });
 await page.goto('/wines/w1');
 await expect(page.getByRole('heading',{name:fixture.wineName,exact:true})).toBeVisible();
 await expect(page.getByText('Change LWIN',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Reject match|Recheck LWIN|Use LWIN value/})).toHaveCount(0);
 await expect(page.getByText('LWIN suggested updates',{exact:true})).toHaveCount(0);
});

for(const choice of ['confirm','none'] as const)test(`members review a proposed identity before logging (${choice})`,async({page},info)=>{
 let checks=0,writes=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'member',role:'member',email:'member@example.com',display_name:'Member',status:'active'}}});
  if(path==='/api/tastings/active')return route.fulfill({json:{tasting:null}});
  if(path==='/api/wines/reference-check'){checks++;return route.fulfill({json:{matched:true,needsReview:true,producer:'Domaine Example',wineName:'Savigny-lès-Beaune',country:'France',region:'Burgundy',colour:'White',token:'reviewed-match'}})}
  if(path==='/api/wines'&&route.request().method()==='POST'){
   expect(route.request().postDataJSON().referenceDecision).toEqual(choice==='none'?{action:'none'}:{action:'confirm',token:'reviewed-match'});writes++;
   return route.fulfill({status:201,json:{id:'w1'}});
  }
  if(path==='/api/wines/w1')return route.fulfill({json:{...fixture,id:'w1',referenceSuggestions:[]}});
  if(path.endsWith('/research-status'))return route.fulfill({status:404,json:{error:'No run'}});
  return route.fulfill({json:{items:[],holdings:[],total:0,matched:false}});
 });
 await page.goto('/wines/new');
 await page.getByLabel('Producer *',{exact:true}).fill('Domaine Example');
 await page.getByLabel('Wine name *',{exact:true}).fill('Savigny');
 await page.getByRole('button',{name:'Save wine',exact:true}).click();
 await expect(page.getByRole('group',{name:'Is this the same wine?'})).toBeVisible();expect(writes).toBe(0);
 await page.getByLabel('Wine name *',{exact:true}).fill('Savigny-lès-Beaune');
 await expect(page.getByRole('group',{name:'Is this the same wine?'})).toHaveCount(0);
 await page.getByRole('button',{name:'Save wine',exact:true}).click();
 await expect(page.getByRole('group',{name:'Is this the same wine?'})).toBeVisible();
 await expect(page.getByRole('radio')).toHaveCount(0);
 expect(checks).toBe(2);expect(writes).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`logging-identity-${choice}.png`),fullPage:true});
 await page.getByRole('button',{name:choice==='none'?'Keep my details':'Yes, save wine',exact:true}).click();
 await expect(page).toHaveURL(/\/wines\/w1$/);expect(writes).toBe(1);
});

for(const outcome of ['clear','missing','unavailable'] as const)test(`logging saves with one tap when the match is ${outcome}`,async({page})=>{
 let writes=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'member',role:'member',email:'member@example.com',display_name:'Member',status:'active'}}});
  if(path==='/api/tastings/active')return route.fulfill({json:{tasting:null}});
  if(path==='/api/wines/reference-check')return outcome==='unavailable'?route.fulfill({status:503,json:{error:'Unavailable'}}):route.fulfill({json:{matched:outcome==='clear',needsReview:false,token:outcome==='clear'?'clear-match':null}});
  if(path==='/api/wines'&&route.request().method()==='POST'){
   expect(route.request().postDataJSON().referenceDecision).toEqual(outcome==='clear'?{action:'confirm',token:'clear-match'}:{action:'unmatched'});writes++;
   return route.fulfill({status:201,json:{id:'w1'}});
  }
  if(path==='/api/wines/w1')return route.fulfill({json:{...fixture,id:'w1',referenceSuggestions:[]}});
  if(path.endsWith('/research-status'))return route.fulfill({status:404,json:{error:'No run'}});
  return route.fulfill({json:{items:[],holdings:[],total:0,matched:false}});
 });
 await page.goto('/wines/new');
 await page.getByLabel('Producer *',{exact:true}).fill('Domaine Example');
 await page.getByLabel('Wine name *',{exact:true}).fill('Savigny-lès-Beaune');
 await page.getByRole('button',{name:'Save wine',exact:true}).click();
 await expect(page).toHaveURL(/\/wines\/w1$/);
 await expect(page.getByRole('group',{name:'Is this the same wine?'})).toHaveCount(0);expect(writes).toBe(1);
});

for(const entry of ['review','detail'] as const)test(`reject a LWIN match from ${entry} and keep the wine without one`,async({page},info)=>{
 let wine={...fixture,id:'w1',lwin7:'1234567' as string|null,lwin11:'12345672020' as string|null,elid:'FR-EXAMPLE-2020' as string|null,referenceSite:fixture.referenceSite as string|null,colour:fixture.colour as string|null,productSubtype:fixture.productSubtype as string|null,identityMatchStatus:'conflict',referenceSuggestions:[]};
 let writes=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/rollout/lwin-review')return route.fulfill({json:{items:wine.identityMatchStatus==='conflict'?[{...wine,conflict:true}]:[],total:wine.identityMatchStatus==='conflict'?1:0,nextCursor:null}});
  if(path==='/api/wines/w1/reference-review'){
   expect(route.request().postDataJSON()).toEqual({action:'reject',lwin7:'1234567',updatedAt:fixture.updatedAt});
   writes++;wine={...wine,lwin7:null,lwin11:null,elid:null,referenceSite:null,colour:null,productSubtype:null,identityMatchStatus:'manual',updatedAt:'2026-09-20T01:00:00Z'};
   return route.fulfill({json:{ok:true,lwin7:null,referenceSuggestions:[]}});
  }
  if(path==='/api/wines/w1')return route.fulfill({json:wine});
  if(path.endsWith('/research-status'))return route.fulfill({status:404,json:{error:'No run'}});
  return route.fulfill({json:{items:[],holdings:[],total:0}});
 });
 await page.goto(entry==='review'?'/admin/lwin-review?wine=w1':'/wines/w1');
 const reject=page.getByRole('button',{name:'Reject match — keep without LWIN',exact:true});
 await expect(reject).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await reject.click();
 if(entry==='review'){
  await expect(page.getByText('All caught up. No wines need review.')).toBeVisible();
  await page.goto('/wines/w1');
 }
 await expect(page.locator('.lwin-link-editor')).toHaveCount(0);
 await expect(reject).toHaveCount(0);
 await expect(page.getByText('LWIN site',{exact:true})).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('heading',{name:fixture.wineName,exact:true})).toBeVisible();
 await expect(page.locator('.lwin-link-editor')).toHaveCount(0);
 await page.getByRole('link',{name:'Edit tasting',exact:true}).click();
 await page.getByText('LWIN reference',{exact:true}).click();
 await page.getByText('Link a LWIN',{exact:true}).click();
 await expect(page.getByLabel('LWIN code',{exact:true})).toBeVisible();
 expect(writes).toBe(1);
 await page.screenshot({path:info.outputPath(`no-lwin-${entry}.png`),fullPage:true});
});

test('review cards resolve in place and preserve the return route',async({page},info)=>{
 const wines=[
  {...fixture,id:'w1',producer:'Domaine de la Vougeraie',wineName:'Bourgogne, Terres de Famille Pinot Noir',lwin7:'1059328',identityMatchStatus:'matched',referenceSuggestions:[{field:'producer',label:'Producer',current:'Domaine de la Vougeraie',suggested:'de la Vougeraie'}],imageIds:[]},
  {...fixture,id:'w2',producer:'Example producer',wineName:'Second wine',lwin7:'1000002',identityMatchStatus:'conflict',referenceSuggestions:[],imageIds:[]}
 ];
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/rollout/lwin-review'){
   const items=wines.filter(w=>w.identityMatchStatus==='conflict'||w.referenceSuggestions.length).map(w=>({...w,conflict:w.identityMatchStatus==='conflict'}));
   return route.fulfill({json:{items,total:items.length,nextCursor:null}});
  }
  if(path==='/api/wines/w1/reference-suggestion'){
   expect(route.request().postDataJSON()).toEqual({field:'producer',action:'keep'});wines[0].referenceSuggestions=[];
   return route.fulfill({json:{ok:true,referenceSuggestions:[]}});
  }
  if(path.endsWith('/research-status'))return route.fulfill({status:404,json:{error:'No run'}});
  const found=wines.find(w=>path===`/api/wines/${w.id}`);if(found)return route.fulfill({json:found});
  return route.fulfill({json:{items:[],holdings:[],total:0}});
 });
 await page.goto('/admin/lwin-review');
 await expect(page.getByText('2 wines remaining')).toBeVisible();
 await page.getByRole('button',{name:/Domaine de la Vougeraie/}).click();
 await expect(page.getByRole('button',{name:'Keep current'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('lwin-review-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Keep current'}).click();
 await expect(page.getByText('1 wines remaining')).toBeVisible();
 await expect(page.getByRole('button',{name:/Domaine de la Vougeraie/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Confirm stored LWIN 1000002'})).toBeVisible();
 await page.getByRole('link',{name:'Open wine',exact:true}).click();
 await expect(page.getByRole('link',{name:/Needs review/}).first()).toBeVisible();
 await page.getByRole('link',{name:/Needs review/}).first().click();
 await expect(page).toHaveURL(/admin\/lwin-review\?wine=w2/);
 await expect(page.getByRole('button',{name:'Confirm stored LWIN 1000002'})).toBeVisible();
});

for(const entry of ['review','detail'] as const)for(const colorScheme of ['light','dark'] as const)test(`manual LWIN preview and confirmation from ${entry} on mobile (${colorScheme})`,async({page},info)=>{
 await page.emulateMedia({colorScheme});
 const wine={...fixture,id:'w1',producer:'Chateau Rieussec',wineName:'Château Rieussec',vintage:2018,lwin7:'1017425',identityMatchStatus:'conflict',referenceSuggestions:[],imageIds:[]};
 let writes=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/rollout/lwin-review')return route.fulfill({json:{items:wine.identityMatchStatus==='conflict'?[{...wine,conflict:true}]:[],total:wine.identityMatchStatus==='conflict'?1:0,nextCursor:null}});
  if(path==='/api/wines/w1/reference-preview')return route.fulfill({json:{requestedLwin7:'1017483',lwin7:'1017483',storedLwin7:'1017425',displayName:'Chateau Rieussec Premier Cru Classe, Sauternes',country:'France',region:'Bordeaux',colour:'White',productSubtype:'Still',vintage:2018,lwin11:'10174832018',suggestions:[],previewToken:'preview-token'}});
  if(path==='/api/wines/w1/reference-review'){
   expect(route.request().postDataJSON()).toEqual({action:'link',lwin7:'1017483',previewToken:'preview-token'});writes++;wine.lwin7='1017483';wine.identityMatchStatus='manual';return route.fulfill({json:{ok:true,lwin7:wine.lwin7}});
  }
  if(path==='/api/wines/w1')return route.fulfill({json:wine});
  return route.fulfill({json:{items:[],total:0}});
 });
 await page.goto(entry==='review'?'/admin/lwin-review?wine=w1':'/wines/w1');
 await page.getByText('Change LWIN',{exact:true}).click();
 await page.getByLabel('LWIN code',{exact:true}).fill('1017483');
 await page.getByRole('button',{name:'Preview LWIN',exact:true}).click();
 await expect(page.getByText('Chateau Rieussec Premier Cru Classe, Sauternes',{exact:true})).toBeVisible();
 expect(writes).toBe(0);
 await page.getByLabel('LWIN code',{exact:true}).fill('1017484');
 await expect(page.getByRole('button',{name:'Link LWIN 1017483',exact:true})).toHaveCount(0);
 await page.getByLabel('LWIN code',{exact:true}).fill('1017483');
 await page.getByRole('button',{name:'Preview LWIN',exact:true}).click();
 await expect(page.getByRole('button',{name:'Link LWIN 1017483',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`manual-lwin-${colorScheme}.png`),fullPage:true});
 await page.getByRole('button',{name:'Link LWIN 1017483',exact:true}).click();
 if(entry==='review'){
  await expect(page.getByText('All caught up. No wines need review.')).toBeVisible();
  await page.goto('/wines/w1');
 }
 await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
 await expect(page.locator('.lwin-link-editor')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Stored LWIN reference'})).toHaveCount(0);
 await expect(page.locator('.detail-wine-facts')).toContainText('1017483');
 await page.reload();
 await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
 await expect(page.locator('.lwin-link-editor')).toHaveCount(0);
 expect(writes).toBe(1);
});
