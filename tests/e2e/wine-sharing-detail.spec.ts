import { test,expect,type Page } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

async function setup(page:Page,role:string,initial:string[]=[]){
 let recipients=[...initial];
 const requests:string[]=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  requests.push(`${request.method()} ${path}`);
  if(path==='/api/me')return route.fulfill({json:{user:{id:'reader',role,email:'reader@example.com',display_name:'Reader',status:'active'}}});
  // The share count rides along with the wine, exactly as the worker sends it.
  if(path==='/api/wines/layout-wine'||path==='/api/shared/wines/layout-wine')return route.fulfill({json:{...wine,identityMatchStatus:'manual',ownerName:'Gary',friendTagCount:recipients.length}});
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
 const requests=await setup(page,role);
 await page.goto('/wines/layout-wine');
 const tag=page.getByRole('button',{name:/^Tag friends/});
 await expect(tag).toHaveAccessibleName('Tag friends, no friends tagged');
 // Opening a wine must not buy that answer with a request of its own.
 expect(requests.filter(request=>request.includes('/shares'))).toEqual([]);
 await tag.click();
 // Naming the friends still needs the endpoint, and asks once the sheet opens.
 await expect.poll(()=>requests.filter(request=>request.includes('/shares'))).not.toEqual([]);
 const sheet=page.getByRole('dialog',{name:'Tag friends',exact:true});
 await expect(sheet.locator('.friend-tag-relationship')).toHaveCount(0);
 await sheet.getByRole('button',{name:'Alice',exact:true}).click();
 await sheet.getByRole('button',{name:'Bob',exact:true}).click();
 await sheet.getByRole('button',{name:'Confirm tags',exact:true}).click();
 await expect(sheet).toHaveCount(0);
 await expect(tag).toHaveAccessibleName('Tag friends, 2 friends tagged');
 await expect(tag).toHaveClass(/active/);
 await expect(page.getByRole('status')).toHaveText('Tagged with 2 friends.');
 await actionsFit(page);
 await page.reload();
 await expect(tag).toHaveAccessibleName('Tag friends, 2 friends tagged');
 await expect(page.getByText('Shared with Alice, Bob',{exact:true})).toHaveCount(0);
 await tag.click();
 await expect(sheet.locator('.friend-tag-relationship')).toHaveCount(0);
 // Cancelled picker changes must not alter the saved sharing state.
 await sheet.getByRole('button',{name:'Alice',exact:true}).click();
 await expect(sheet.locator('.friend-tag-relationship')).toHaveCount(0);
 await sheet.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(tag).toHaveAccessibleName('Tag friends, 2 friends tagged');
 await tag.click();
 await expect(sheet.getByRole('button',{name:'Alice',exact:true})).toHaveAttribute('aria-pressed','true');
 await sheet.getByRole('button',{name:'Alice',exact:true}).click();
 await sheet.getByRole('button',{name:'Bob',exact:true}).click();
 await sheet.getByRole('button',{name:'Confirm tags',exact:true}).click();
 await expect(tag).toHaveAccessibleName('Tag friends, no friends tagged');
 await expect(tag).not.toHaveClass(/active/);
 await expect(page.getByRole('status')).toHaveText('Friend tags removed.');
 await actionsFit(page);
});

for(const role of ['owner','member'])test(`${role}: recipient sharing sheet names only the sharer and never calls owner APIs`,async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const requests=await setup(page,role,['alice','bob']);
 await page.goto('/shared/layout-wine');
 await expect(page.getByRole('heading',{name:wine.wineName,exact:true})).toBeVisible();
 await expect(page.locator('.shared-source-indicator')).toHaveCount(0);
 await expect(page.getByText('Shared by Gary',{exact:true})).toHaveCount(0);
 // The page never names the sharer, but it does say the research is inherited.
 await expect(page.getByText(/^Shared research · updated /)).toBeVisible();
 await expect(page.getByText(/Research shared by/)).toHaveCount(0);
 const tag=page.getByRole('button',{name:'Sharing details',exact:true});
 await expect(tag).not.toHaveClass(/active/);
 await tag.click();
 const sheet=page.getByRole('dialog',{name:'Tagged friends',exact:true});
 await expect(sheet).toContainText('Shared by Gary');
 const heading=(await sheet.getByRole('heading',{name:'Tagged friends',exact:true}).boundingBox())!;
 const relationship=(await sheet.getByText('Shared by Gary',{exact:true}).boundingBox())!;
 expect(relationship.y).toBeGreaterThanOrEqual(heading.y+heading.height);
 await expect(sheet.locator('footer').getByRole('button',{name:'Close',exact:true})).toBeVisible();
 await expect(sheet.getByRole('group',{name:'Friends'})).toHaveCount(0);
 await expect(sheet.getByRole('button',{name:'Confirm tags'})).toHaveCount(0);
 await expect(sheet).not.toContainText(/Alice|Bob/);
 await sheet.locator('footer').getByRole('button',{name:'Close',exact:true}).click();
 await expect(tag).toBeFocused();
 await actionsFit(page);
 expect(requests.filter(request=>request.includes('/shares')||request.includes('/api/friends'))).toEqual([]);
});

test('failed share reads cannot overwrite existing tags',async({page})=>{
 await setup(page,'member',['alice']);
 await page.goto('/wines/layout-wine');
 const tag=page.getByRole('button',{name:/^Tag friends/});
 await expect(tag).toHaveAccessibleName('Tag friends, 1 friend tagged');
 await page.route('**/api/wines/layout-wine/shares',route=>route.fulfill({status:503,json:{error:'Sharing unavailable'}}));
 await tag.click();
 const sheet=page.getByRole('dialog',{name:'Tag friends',exact:true});
 await expect(sheet.getByRole('alert')).toContainText('Sharing unavailable');
 await expect(sheet.getByRole('button',{name:'Confirm tags'})).toBeDisabled();
 await sheet.getByRole('button',{name:'Close',exact:true}).click();
 await expect(tag).toHaveAccessibleName('Tag friends, 1 friend tagged');
});

// An unread list and an empty one look identical once rendered, so the sheet
// has to say which it is rather than leaving the space blank.
test('the sheet says it is loading rather than showing an empty friend list',async({page})=>{
 await setup(page,'member');
 await page.goto('/wines/layout-wine');
 let release=()=>{};
 const held=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/api/friends',async route=>{await held;await route.fulfill({json:{items:[{id:'alice',display_name:'Alice'}]}})});
 await page.getByRole('button',{name:/^Tag friends/}).click();
 const sheet=page.getByRole('dialog',{name:'Tag friends',exact:true});
 await expect(sheet.getByText('Loading friends…',{exact:true})).toBeVisible();
 await expect(sheet.getByText('Add a friend from Account & friends first.',{exact:true})).toHaveCount(0);
 await expect(sheet.getByRole('button',{name:'Confirm tags',exact:true})).toBeDisabled();
 release();
 await expect(sheet.getByRole('button',{name:'Alice',exact:true})).toBeVisible();
 await expect(sheet.getByText('Loading friends…',{exact:true})).toHaveCount(0);
});

// A member with no friends yet must still be told what to do about it.
test('the sheet keeps its empty state once the read lands',async({page})=>{
 await setup(page,'member');
 await page.goto('/wines/layout-wine');
 await page.route('**/api/friends',route=>route.fulfill({json:{items:[]}}));
 await page.getByRole('button',{name:/^Tag friends/}).click();
 const sheet=page.getByRole('dialog',{name:'Tag friends',exact:true});
 await expect(sheet.getByText('Add a friend from Account & friends first.',{exact:true})).toBeVisible();
 await expect(sheet.getByText('Loading friends…',{exact:true})).toHaveCount(0);
});
