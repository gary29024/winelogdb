import { test,expect,devices } from '@playwright/test';
import { wine } from './fixtures/layoutWine';

// A 1x1 PNG is enough: the check is about the overlay's box, not the photo.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');

test.use({viewport:devices['iPhone 15 Pro'].viewport,isMobile:true,hasTouch:true});

test('the photo viewer covers the whole phone screen',async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/images/')){await route.fulfill({body:png,contentType:'image/png'});return}
  if(path.endsWith('/research-status')){await route.fulfill({status:404,json:{error:'No run'}});return}
  const data=path==='/api/me'?{user:{id:'reader',email:'reader@example.com',display_name:'Reader',role:'member',status:'active'}}
   :path==='/api/wines/layout-wine'?{...wine,imageIds:['a','b']}
   :{items:[],holdings:[],total:0,runs:[]};
  await route.fulfill({json:data});
 });
 await page.goto('/wines/layout-wine');
 await page.locator('.detail-gallery .detail-photo-button').first().click();
 const box=await page.locator('.image-lightbox').boundingBox(),close=await page.locator('.lightbox-close').boundingBox();
 const width=page.viewportSize()!.width;
 expect(box).toMatchObject({x:0,y:0,width});
 expect(close!.x+close!.width).toBeLessThanOrEqual(width);
});
