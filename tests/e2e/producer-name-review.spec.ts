import { test,expect } from '@playwright/test';

test.use({viewport:{width:393,height:852}});
for(const colorScheme of ['light','dark'] as const)test(`producer correction previews and updates the group on mobile (${colorScheme})`,async({page},info)=>{
 await page.emulateMedia({colorScheme});let writes=0;
 const wines=['w1','w2'].map((id,index)=>({id,producer:'de la Vougeraie',producerId:'p1',wineName:index?'Clos de Vougeot':'Terres de Famille Pinot Noir',vintage:2020,lwin7:'1059328',identityMatchStatus:'matched',imageIds:[],updatedAt:'before',referenceSuggestions:[{field:'producer',label:'Producer',current:'de la Vougeraie',suggested:'Domaine de la Vougeraie'}]}));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'}}});
  if(path==='/api/admin/rollout/lwin-review'){const items=wines.filter(wine=>wine.referenceSuggestions.length).map(wine=>({...wine,conflict:false}));return route.fulfill({json:{items,total:items.length,nextCursor:null}})}
  if(path==='/api/wines/w1/producer-name-review'){
   if(route.request().method()==='GET')return route.fulfill({json:{producerId:'p1',currentName:'de la Vougeraie',name:'Domaine de la Vougeraie',wineCount:2,previousNames:['de la Vougeraie'],sample:wines,conflictProducerId:null,previewToken:'group-snapshot'}});
   expect(route.request().postDataJSON()).toEqual({previewToken:'group-snapshot'});writes++;
   wines.forEach(wine=>{wine.producer='Domaine de la Vougeraie';wine.referenceSuggestions=[];wine.updatedAt='after'});
   return route.fulfill({json:{ok:true,producerId:'p1',updated:2}});
  }
  const wine=wines.find(wine=>path===`/api/wines/${wine.id}`);if(wine)return route.fulfill({json:wine});
  return route.fulfill({json:{items:[],total:0}});
 });
 await page.goto('/admin/lwin-review?wine=w1');
 await page.getByRole('button',{name:'Apply producer name to all linked wines…'}).click();
 await expect(page.getByText('Use this producer name on all 2 linked wines and on the producer profile.')).toBeVisible();
 await expect(page.getByText(/Previous names stay available as aliases automatically/)).toBeVisible();expect(writes).toBe(0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(writes).toBe(0);
 await expect(page.getByRole('button',{name:'Apply to 2 wines',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Apply producer name to all linked wines…'}).click();
 await expect(page.getByRole('button',{name:'Apply to 2 wines',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`producer-review-${colorScheme}.png`),fullPage:true});
 await page.getByRole('button',{name:'Apply to 2 wines',exact:true}).click();
 await expect(page.getByText('All caught up. No wines need review.')).toBeVisible();expect(writes).toBe(1);
});

test('a producer collision opens the existing identity controls without an apply button',async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const wine={id:'w1',producer:'Example',wineName:'Example wine',identityMatchStatus:'matched',updatedAt:'before',imageIds:[],referenceSuggestions:[{field:'producer',label:'Producer',current:'Example',suggested:'Domaine Example'}]};
  if(path==='/api/me')return route.fulfill({json:{user:{id:'owner',role:'owner',status:'active'}}});
  if(path==='/api/admin/rollout/lwin-review')return route.fulfill({json:{items:[wine],total:1,nextCursor:null}});
  if(path==='/api/wines/w1')return route.fulfill({json:wine});
  if(path==='/api/wines/w1/producer-name-review'){expect(route.request().method()).toBe('GET');return route.fulfill({json:{producerId:'p1',currentName:'Example',name:'Domaine Example',wineCount:3,previousNames:['Example'],sample:[],conflictProducerId:'p2',previewToken:'conflict'}})}
  return route.fulfill({json:{}});
 });
 await page.goto('/admin/lwin-review?wine=w1');await page.getByRole('button',{name:'Apply producer name to all linked wines…'}).click();
 await expect(page.getByRole('link',{name:'Open Identity & aliases'})).toHaveAttribute('href','/producers/p1');
 await expect(page.getByRole('button',{name:'Apply to 3 wines',exact:true})).toHaveCount(0);
});
