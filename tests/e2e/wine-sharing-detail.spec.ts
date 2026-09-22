import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

async function setup(page:Page,role:string,initial:string[]=[]){
 let recipients=[...initial];
 const requests:string[]=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  requests.push(`${request.method()} ${path}`);
  if(path==='/api/me')return route.fulfill({json:{user:{id:'reader',role,email:'reader@example.com',display_name:'Reader',status:'active'}}});
  if(path==='/api/wines/layout-wine'||path==='/api/shared/wines/layout-wine')return route.fulfill({json:{...wine,identityMatchStatus:'manual',ownerName:'Gary'}});
  if(path==='/api/friends')return route.fulfill({json:{items:[{id:'alice',display_name:'Alice'},{id:'bob',display_name:'Bob'}]}});
  if(path==='/api/wines/layout-wine/shares'){
   if(request.method()==='PUT')recipients=request.postDataJSON().recipientIds;
   return route.fulfill({json:{recipientIds:recipients,ok:true}});
  }
  if(path.endsWith('/research-status'))return route.fulfill({status:404,json:{error:'No run'}});
  return route.fulfill({json:{items:[],holdings:[],total:0}});
 });
 return requests;
}

async function actionsFit(page:Page){
 const boxes=await page.locator('.wine-actions>button,.wine-actions>a').evaluateAll(items=>items.map(item=>({x:item.getBoundingClientRect().x,y:item.getBoundingClientRect().y,width:item.getBoundingClientRect().width,height:item.getBoundingClientRect().height})));
 expect(Math.max(...boxes.map(box=>box.y))).toBeLessThan(Math.min(...boxes.map(box=>box.y+box.height)));
 if(page.viewportSize()!.width<700)expect(boxes.every(box=>box.height>=44)).toBe(true);
 expect(boxes[2].width).toBeGreaterThan(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

for(const role of ['owner','member'])for(const width of [320,390,1280])test(`${role}: tag state and action layout survive save, reload and removal at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await setup(page,role);
 await page.goto('/wines/layout-wine');
 const tag=page.getByRole('button',{name:'Tag friends',exact:true});
 await expect(tag).toHaveAttribute('aria-pressed','false');
 await tag.click();
 const sheet=page.getByRole('dialog',{name:'Tag friends',exact:true});
 await expect(sheet).toContainText('Not shared yet');
 await sheet.getByRole('button',{name:'Alice',exact:true}).click();
 await sheet.getByRole('button',{name:'Bob',exact:true}).click();
 await sheet.getByRole('button',{name:'Confirm tags',exact:true}).click();
 await expect(sheet).toHaveCount(0);
 await expect(tag).toHaveAttribute('aria-pressed','true');
 await expect(tag).toHaveClass(/active/);
 await expect(page.getByRole('status')).toHaveText('Tags updated.');
 await actionsFit(page);
 await page.reload();
 await expect(tag).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('Shared with Alice, Bob',{exact:true})).toHaveCount(0);
 await tag.click();
 await expect(sheet).toContainText('Shared with Alice, Bob');
 // Unsaved selection changes must not change the saved sharing relationship.
 await sheet.getByRole('button',{name:'Alice',exact:true}).click();
 await expect(sheet).toContainText('Shared with Alice, Bob');
 await sheet.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(tag).toHaveAttribute('aria-pressed','true');
 await tag.click();
 await expect(sheet.getByRole('button',{name:'Alice',exact:true})).toHaveAttribute('aria-pressed','true');
 await sheet.getByRole('button',{name:'Alice',exact:true}).click();
 await sheet.getByRole('button',{name:'Bob',exact:true}).click();
 await sheet.getByRole('button',{name:'Confirm tags',exact:true}).click();
 await expect(tag).toHaveAttribute('aria-pressed','false');
 await expect(tag).not.toHaveClass(/active/);
 await actionsFit(page);
});

for(const role of ['owner','member'])test(`${role}: recipient sharing sheet names only the sharer and never calls owner APIs`,async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const requests=await setup(page,role,['alice','bob']);
 await page.goto('/shared/layout-wine');
 await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
 await expect(page.locator('.shared-source-indicator')).toHaveCount(0);
 await expect(page.getByText('Shared by Gary',{exact:true})).toHaveCount(0);
 const tag=page.getByRole('button',{name:'Sharing details',exact:true});
 await expect(tag).not.toHaveClass(/active/);
 await tag.click();
 const sheet=page.getByRole('dialog',{name:'Sharing',exact:true});
 await expect(sheet).toContainText('Shared by Gary');
 await expect(sheet.getByRole('group',{name:'Friends'})).toHaveCount(0);
 await expect(sheet.getByRole('button',{name:'Confirm tags'})).toHaveCount(0);
 await expect(sheet).not.toContainText(/Alice|Bob/);
 await sheet.getByRole('button',{name:'Close',exact:true}).click();
 await expect(tag).toBeFocused();
 await actionsFit(page);
 expect(requests.filter(request=>request.includes('/shares')||request.includes('/api/friends'))).toEqual([]);
});

test('failed share reads cannot overwrite existing tags',async({page})=>{
 await setup(page,'member',['alice']);
 await page.goto('/wines/layout-wine');
 const tag=page.getByRole('button',{name:'Tag friends',exact:true});
 await expect(tag).toHaveAttribute('aria-pressed','true');
 await page.route('**/api/wines/layout-wine/shares',route=>route.fulfill({status:503,json:{error:'Sharing unavailable'}}));
 await tag.click();
 const sheet=page.getByRole('dialog',{name:'Tag friends',exact:true});
 await expect(sheet.getByRole('alert')).toContainText('Sharing unavailable');
 await expect(sheet.getByRole('button',{name:'Confirm tags'})).toBeDisabled();
 await sheet.getByRole('button',{name:'Close',exact:true}).click();
 await expect(tag).toHaveAttribute('aria-pressed','true');
});
