import {test,expect,login,png} from './fixtures.mjs';

test('archive story is safe multiline text; other collections and empty items omit it',async({page,backend},testInfo)=>{
 const story='Found at a flea market.\n\n<script>window.storyExecuted=true</script>';
 backend.items.forEach(item=>item.personal_story=story);
 for(const [name,id] of [['index','computer'],['music','music'],['books','book'],['comics','comic']]){
  await page.goto(`/${name}.html?item=${id}`);
  await expect(page.locator('#item-detail')).toBeVisible();
  await expect(page.locator('.personal-story')).toHaveCount(name==='index'?1:0);
  if(name==='index'){
   await expect(page.locator('.personal-story p')).toHaveText(story);
   expect(await page.evaluate(()=>window.storyExecuted)).toBeUndefined();
   await page.locator('.personal-story').scrollIntoViewIfNeeded();
   await page.screenshot({path:testInfo.outputPath('story-detail.png')});
  }
 }
 backend.items[0].personal_story='';
 await page.goto('/index.html?item=computer');
 await expect(page.locator('#item-detail')).toBeVisible();
 await expect(page.locator('.personal-story')).toHaveCount(0);
});

test('admin saves, reloads, retries and removes an existing archive story',async({page,backend},testInfo)=>{
 await login(page);
 await page.locator('#existing-item').selectOption('computer');
 await page.locator('#existing-personal-story').fill('My first computer.\nA gift from my family.');
 await page.locator('#save-story-button').click();
 await expect(page.locator('#story-status')).toHaveText('PERSONAL STORY SAVED');
 await page.locator('#existing-item').selectOption('merch');
 await page.locator('#existing-item').selectOption('computer');
 await expect(page.locator('#existing-personal-story')).toHaveValue('My first computer.\nA gift from my family.');
 await page.locator('#existing-story-editor').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('story-editor.png')});
 backend.failSave=true;
 await page.locator('#existing-personal-story').fill('Revised memory');
 await page.locator('#save-story-button').click();
 await expect(page.locator('#story-status')).toContainText('INTERRUPTED');
 await expect(page.locator('#existing-personal-story')).toHaveValue('Revised memory');
 backend.failSave=false;
 await page.locator('#existing-personal-story').fill('');
 await page.locator('#save-story-button').click();
 await expect(page.locator('#story-status')).toHaveText('PERSONAL STORY SAVED');
 expect(backend.writes.filter(write=>write.method==='PATCH').at(-1).body).toEqual({personal_story:null});
});

test('new artifact stores a story; changing kind hides and excludes it from music save',async({page,backend})=>{
 await login(page);
 await page.locator('[name="personal_story"]').fill('A childhood memory.');
 await page.locator('#item-title').fill('Keepsake');
 await page.locator('#image-files').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});
 await page.locator('#storage-folder').fill('computers');
 await page.locator('#save-button').click();
 await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');
 expect(backend.writes.find(write=>write.path==='/rest/v1/items'&&write.method==='POST').body.personal_story).toBe('A childhood memory.');
 await page.locator('[name="personal_story"]').fill('Should stay in Archive');
 for(const kind of ['books','comics','music']){
  await page.locator('#record-kind').selectOption(kind);
  await expect(page.locator('[name="personal_story"]')).toBeHidden();
  await expect(page.locator('[name="personal_story"]')).toBeDisabled();
 }
 await page.locator('#item-title').fill('Album');
 await page.locator('[name="music_format"]').fill('LP');
 await page.locator('[name="music_artist"]').fill('Artist');
 await page.locator('#image-files').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});
 await page.locator('#storage-folder').fill('music');
 await page.locator('#save-button').click();
 await expect(page.locator('#save-status')).toContainText('COMMIT COMPLETE');
 await expect.poll(()=>backend.writes.filter(write=>write.path==='/rest/v1/items'&&write.method==='POST').length).toBe(2);
 expect(backend.writes.filter(write=>write.path==='/rest/v1/items'&&write.method==='POST').at(-1).body).not.toHaveProperty('personal_story');
});

test('existing music and publications cannot use the story editor',async({page,backend})=>{
 const excluded=backend.items.filter(item=>['music','book','comic','room'].includes(item.id));
 backend.items.splice(0,backend.items.length,...excluded);
 await login(page);
 for(const id of ['music','book']){
  await page.locator('#existing-item').selectOption(id);
  await expect(page.locator('#existing-story-editor')).toBeHidden();
 }
});
