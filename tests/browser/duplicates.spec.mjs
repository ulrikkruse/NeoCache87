import {test,expect,login,png} from './fixtures.mjs';
async function photo(page){await page.locator('#image-files').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});await page.locator('#storage-folder').fill('books');}
test('ISBN lookup warns for an existing edition on a later page, before selection',async({page,backend},testInfo)=>{
 await login(page);await page.locator('#record-kind').selectOption('books');
 await page.locator('#pub-lookup-query').fill('9780140328721');await page.locator('#pub-lookup-search').click();
 await expect(page.locator('#duplicate-list')).toContainText('Absence');
 await expect(page.locator('#duplicate-list')).toContainText('Same ISBN');
 await expect(page.locator('#duplicate-list a')).toHaveAttribute('href','books.html?item=book');
 await page.getByRole('button',{name:'USE THIS EDITION'}).click();
 await expect(page.locator('#duplicate-warning')).toBeVisible();
 await photo(page);await page.locator('#save-button').click();
 await expect(page.locator('#save-status')).toContainText('CHECK DUPLICATE WARNING');
 expect(backend.writes).toEqual([]);
 await page.locator('#duplicate-warning').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('duplicate-warning.png')});
 await page.locator('#duplicate-confirm').check();await page.locator('#save-button').click();
 await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');
 expect(backend.writes.filter(w=>w.path==='/rest/v1/items'&&w.method==='POST')).toHaveLength(1);
});
test('changing data clears approval and removing a match clears the warning',async({page,backend})=>{
 await login(page);await page.locator('#item-title').fill('Amiga');
 await expect(page.locator('#duplicate-list')).toContainText('Same title');
 await page.locator('#duplicate-confirm').check();
 await page.locator('#item-title').fill('Tour shirt');
 await expect(page.locator('#duplicate-list')).toContainText('Tour shirt');
 await expect(page.locator('#duplicate-confirm')).not.toBeChecked();
 await page.locator('#item-title').fill('A unique artifact');
 await expect(page.locator('#duplicate-warning')).toBeHidden();
});
test('fresh check catches an item added after the form was filled',async({page,backend})=>{
 await login(page);await page.locator('#item-title').fill('New arrival');await photo(page);
 backend.items.push({id:'new-arrival',title:'New arrival',type:'Computer'});
 await page.locator('#save-button').click();
 await expect(page.locator('#save-status')).toContainText('CHECK DUPLICATE WARNING');
 expect(backend.writes).toEqual([]);
});
test('failed duplicate check prevents writes and retry can succeed',async({page,backend})=>{
 await login(page);await page.locator('#item-title').fill('Unique artifact');await photo(page);
 await page.route('**/rest/v1/items?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"Unavailable"}'}));
 await page.locator('#save-button').click();
 await expect(page.locator('#duplicate-message')).toContainText('UNAVAILABLE');
 expect(backend.writes).toEqual([]);
 await page.unroute('**/rest/v1/items?**');
 await page.locator('#save-button').click();await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');
});
