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
