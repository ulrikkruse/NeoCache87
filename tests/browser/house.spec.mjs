import {test,expect,login,png} from './fixtures.mjs';
function house(backend){backend.items.push({id:'house-photo',title:'Living room pop culture',type:'Photo',category:'Rooms',images:[{storage_path:'house/front.png'}],item_tags:[{tags:{name:'house'}}]});}
test('The House filters room photos and stays outside object collections',async({page,backend},info)=>{
 house(backend);backend.items.push({id:'cinema-photo',title:'Cinema',images:[{storage_path:'cinema/front.png'}],item_tags:[{tags:{name:'home-cinema'}}]});
 await page.goto('/rooms.html');await expect(page.locator('.room-photo')).toHaveCount(4);
 await page.getByRole('button',{name:'THE HOUSE',exact:true}).click();await expect(page.locator('.room-photo')).toHaveCount(1);await expect(page.locator('#photo-count')).toHaveText('1 photo');await expect(page.locator('.room-photo')).toContainText('Living room pop culture');
 await expect(page.getByRole('button',{name:'THE HOUSE',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('rooms-house.png'),fullPage:true});
 await page.locator('.room-photo').click();await expect(page.locator('#full-photo')).toHaveAttribute('src',/house\/front.png$/);await page.locator('#close-viewer').click();
 await page.getByRole('button',{name:'HOME CINEMA',exact:true}).click();await expect(page.locator('.room-photo')).toHaveCount(1);await expect(page.locator('.room-photo')).toContainText('Cinema');
 await page.getByRole('button',{name:'80S ROOM',exact:true}).click();await expect(page.locator('.room-photo')).toHaveCount(2);
 await page.getByRole('button',{name:'ALL PHOTOS',exact:true}).click();await expect(page.locator('.room-photo')).toHaveCount(4);
 for(const name of ['index','music','books','comics']){await page.goto(`/${name}.html`);await expect(page.locator('.item-card').first()).toBeVisible();await expect(page.locator('.item-card').filter({hasText:'Living room pop culture'})).toHaveCount(0);}
});
test('admin saves house gallery tag and excludes house photos from Archive stories',async({page,backend})=>{
 house(backend);
 await page.route('https://fixture.invalid/rest/v1/tags',async route=>{
  if(route.request().method()!=='POST')return route.fallback();
  const body=route.request().postDataJSON();backend.writes.push({path:'/rest/v1/tags',method:'POST',body});
  await route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'house-tag',...body}])});
 });
 await login(page);await page.locator('#existing-item').selectOption('house-photo');await expect(page.locator('#existing-story-editor')).toBeHidden();
 await page.locator('#item-title').fill('The hallway');await page.locator('#room-gallery').selectOption('house');await page.locator('#storage-folder').fill('house');await page.locator('#image-files').setInputFiles({name:'hallway.png',mimeType:'image/png',buffer:png});
 await page.locator('#save-button').click();await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');
 expect(backend.writes.find(w=>w.path==='/rest/v1/tags').body).toEqual({name:'house'});
 expect(backend.writes.find(w=>w.path==='/rest/v1/item_tags'&&w.method==='POST').body).toEqual([{item_id:'created-fixture',tag_id:'house-tag'}]);
});
