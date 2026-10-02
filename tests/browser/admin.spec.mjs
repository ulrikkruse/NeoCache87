import {test,expect,login,png} from './fixtures.mjs';
async function photo(page){await page.locator('#image-files').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});await page.locator('#storage-folder').fill('books');}
test('admin switches kinds and refreshes Storage suggestions',async({page,backend})=>{
 await login(page);await page.locator('#record-kind').selectOption('books');await expect(page.locator('#publication-fields')).toBeVisible();await expect(page.locator('#music-fields')).toBeHidden();
 await page.locator('#record-kind').selectOption('music');await expect(page.locator('#music-fields')).toBeVisible();await expect(page.locator('#publication-fields')).toBeHidden();
 await page.locator('#record-kind').selectOption('artifact');await expect(page.locator('[name="manufacturer"]')).toBeVisible();
 backend.folders.push('new-folder');await page.locator('#storage-folder').focus();await expect(page.locator('#folder-options option[value="new-folder"]')).toHaveCount(1);
 await page.getByRole('button',{name:'DISCONNECT'}).click();await expect(page.locator('#login-panel')).toBeVisible();
});
test('ISBN selection fills only after confirmation and saves a book',async({page,backend})=>{
 await login(page);await page.locator('#record-kind').selectOption('books');await page.locator('#item-title').fill('Original');
 await page.locator('#pub-lookup-query').fill('9780140328721');await page.locator('#pub-lookup-search').click();
 await expect(page.getByRole('button',{name:'USE THIS EDITION'})).toBeVisible();await expect(page.locator('#item-title')).toHaveValue('Original');
 await page.getByRole('button',{name:'USE THIS EDITION'}).click();await expect(page.locator('#item-title')).toHaveValue('Scanned Book');
 await photo(page);await expect(page.locator('#duplicate-list')).toContainText('Same ISBN');await page.locator('#duplicate-confirm').check();await page.locator('#save-button').click();await expect(page.locator('#save-status')).toContainText('ARCHIVE COMMIT COMPLETE');
 const detail=backend.writes.find(r=>r.path==='/rest/v1/publication_details'&&r.method==='POST');
 expect(detail.body).toMatchObject({kind:'books',isbn:'9780140328721',openlibrary_id:'OL123M'});
 expect(backend.writes.find(r=>r.path==='/rest/v1/items').body.category).toBe('Books');
});
test('title lookup fetches chosen edition and failures preserve manual fields',async({page,backend})=>{
 await login(page);await page.locator('#record-kind').selectOption('comics');
 await page.locator('#pub-lookup-mode').selectOption('title');await page.locator('#pub-lookup-query').fill('Watchmen');await page.locator('#pub-lookup-search').click();await page.getByRole('button',{name:'USE THIS EDITION'}).click();
 await expect(page.locator('#item-title')).toHaveValue('Scanned Book');expect(backend.publicationLookups.map(r=>r.mode)).toEqual(['title','edition']);
 backend.lookupEmpty=true;await page.locator('#pub-lookup-search').click();await expect(page.locator('#pub-lookup-status')).toContainText('No matches');await expect(page.locator('#item-title')).toHaveValue('Scanned Book');
 backend.lookupFailure=true;await page.locator('#pub-lookup-search').click();await expect(page.locator('#pub-lookup-status')).toContainText('Fixture service unavailable');await expect(page.locator('#item-title')).toHaveValue('Scanned Book');
});
test('comic without ISBN saves its series and leading-zero issue',async({page,backend})=>{
 await login(page);await page.locator('#record-kind').selectOption('comics');await page.locator('#item-title').fill('Comic');await page.locator('[name="publication_format"]').fill('Comic issue');await page.locator('[name="publication_series"]').fill('Fixture Series');await page.locator('[name="publication_issue"]').fill('001');await photo(page);
 await page.locator('#save-button').click();await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');expect(backend.writes.find(r=>r.path==='/rest/v1/publication_details').body).toMatchObject({kind:'comics',series:'Fixture Series',issue:'001'});
});
test('failed detail save reports failure and rolls back uploaded files and item',async({page,backend})=>{
 backend.failSave=true;await login(page);await page.locator('#record-kind').selectOption('books');await page.locator('#item-title').fill('Failure fixture');await page.locator('[name="publication_format"]').fill('Hardcover');await photo(page);await page.locator('#save-button').click();await expect(page.locator('#save-status')).toContainText('COMMIT INTERRUPTED');
 expect(backend.writes.some(r=>r.method==='DELETE'&&r.path==='/rest/v1/items')).toBe(true);expect(backend.writes.some(r=>r.method==='DELETE'&&r.path.startsWith('/storage/'))).toBe(true);
 await expect(page.locator('#save-button')).toBeEnabled();
});
test('music lookup and save continue working alongside publication fields',async({page,backend})=>{
 await login(page);await page.locator('#record-kind').selectOption('music');await page.locator('#lookup-query').fill('001234567890');await page.locator('#lookup-search').click();await page.getByRole('button',{name:'USE THIS RELEASE'}).click();await expect(page.locator('#item-title')).toHaveValue('Scanned Album');await photo(page);await page.locator('#save-button').click();await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');expect(backend.writes.some(r=>r.path==='/rest/v1/music_details')).toBe(true);expect(backend.writes.some(r=>r.path==='/rest/v1/publication_details')).toBe(false);
});
