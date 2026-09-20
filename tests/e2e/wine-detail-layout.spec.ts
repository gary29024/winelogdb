import { test,expect,type Page } from '@playwright/test';

const wine={
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

async function mockWine(page:Page,structure:Record<string,string|null>|null){
 const maturityRequests:string[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/maturity'))maturityRequests.push(path);
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}
   :path==='/api/wines/layout-wine'||path==='/api/shared/wines/layout-wine'?{...wine,tastingStructure:structure,structure}
   :path.endsWith('/research')?{runs:[]}
   :{items:[],holdings:[],total:0};
  await route.fulfill({json:data});
 });
 return maturityRequests;
}

for(const route of ['/wines/layout-wine','/shared/layout-wine']){
 test(`${route}: integrates bottle facts and omits empty structure at phone and desktop sizes`,async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const requests=await mockWine(page,{acidity:null,body:null,finish:null});
  await page.goto(route);
  await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
  const facts=page.locator('.detail-section').filter({has:page.getByText('Wine details',{exact:true})});
  for(const value of [wine.lwin7,wine.lwin11,wine.elid,wine.referenceSite,'White · Still','Chardonnay 100%','13%']){
   await expect(facts.getByText(value,{exact:true})).toBeVisible();
  }
  await expect(page.getByText('Official reference',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Structure',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Site / parcel',{exact:true})).toHaveCount(0);
  await expect(page.locator('.vintage-check')).toHaveCount(0);
  await page.getByRole('button',{name:'Drinking window',exact:true}).click();
  await expect(page.getByText(wine.deepSearch.drinkingWindow,{exact:true})).toBeVisible();
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>window.scrollTo(0,0));
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const contained=await page.locator('.wine-identity').evaluate(card=>{
    const bounds=card.getBoundingClientRect();
    return [...card.querySelectorAll('.detail-pills>span')].every(pill=>pill.getBoundingClientRect().right<=bounds.right);
   });
   expect(contained).toBe(true);
   await page.screenshot({path:testInfo.outputPath(`wine-detail-${width}.png`),fullPage:true});
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
 });

 test(`${route}: shows only structure values supplied by the viewer`,async({page})=>{
  await mockWine(page,{acidity:'high',body:null,finish:'long'});
  await page.goto(route);
  const structure=page.locator('.tasting-structure-summary');
  await expect(structure).toBeVisible();
  await expect(structure.locator('dt')).toHaveText(['Acidity','Finish']);
  await expect(structure.locator('dd')).toHaveText(['High','Long']);
 });
}
