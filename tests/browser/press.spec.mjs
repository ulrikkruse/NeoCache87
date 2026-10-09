import {test,expect,login,png} from './fixtures.mjs';
const id='11111111-1111-4111-8111-111111111111',draft='22222222-2222-4222-8222-222222222222';
function seed(backend){
 const article={id,title:'På turné <script>test</script>',publication:'Fixture Daily',year:1987,publication_date:'1987-04-14',language:'Danish',article_type:'Interview',description:'En dansk beskrivelse.',notes:'Found in my old scrapbook.\nA personal note.',published:true};
 backend.pressArticles.push(article,{...article,id:draft,title:'Private clipping',published:false},{...article,id:'other',title:'English review',year:1986,publication_date:null,language:'English',article_type:'Review'},{...article,id:'unknown',title:'Undated news',year:null,publication_date:null,article_type:'News'});
 backend.pressPages.push(...['Third page','Front page','Second page'].map((caption,i)=>({id:'p'+i,article_id:id,path:`${id}/page${i}.png`,caption,position:[2,0,1][i]})),{id:'private',article_id:draft,path:`${draft}/private.png`,caption:'Private scan',position:0});
}
test('Press Archive filters published clippings across pagination, retaining original headlines',async({page,backend},info)=>{
 seed(backend);await page.goto('/index.html');await page.getByRole('link',{name:'PRESS ARCHIVE'}).click();
 await expect(page.locator('.press-card')).toHaveCount(3);await expect(page.getByText('Private clipping')).toHaveCount(0);
 await expect(page.locator('.press-card img').first()).toHaveAttribute('alt','Front page');
 await page.locator('#press-year').selectOption('1987');await page.locator('#press-language').selectOption('danish');await page.locator('#press-type').selectOption('Interview');await page.locator('#press-search').fill('pa turne');
 await expect(page.locator('.press-card')).toHaveCount(1);
 await page.locator('#press-search').fill('absent');await expect(page.locator('#press-status')).toHaveText('No articles match your filters.');
 await page.locator('#press-reset').click();await expect(page.locator('.press-card')).toHaveCount(3);
 await page.locator('#press-year').selectOption('unknown');await expect(page.locator('.press-card')).toHaveCount(1);await expect(page.locator('.press-meta')).toContainText('Date unknown');
 await page.locator('#press-reset').click();await expect.poll(()=>page.locator('.press-card img').first().evaluate(img=>img.naturalWidth)).toBe(900);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('press-list.png'),fullPage:true});
});
test('Press article opens all scans in order, zooms, navigates and closes',async({page,backend},info)=>{
 seed(backend);await page.goto(`/press.html?article=${id}`);
 await expect(page.locator('#press-article h2')).toHaveText('På turné <script>test</script>');await expect(page.locator('.press-meta')).toContainText('14 Apr 1987');
 await expect(page.locator('.press-pages button')).toHaveText(['PAGE 1 — Front page','PAGE 2 — Second page','PAGE 3 — Third page']);
 await page.locator('.press-pages button').first().click();await expect(page.locator('#press-full-image')).toBeVisible();await expect(page.locator('#press-prev')).toBeDisabled();
 await page.locator('#press-zoom').click();await expect(page.locator('#press-zoom')).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('#press-image-stage').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await page.locator('#press-zoom').click();await page.locator('#press-next').click();await expect(page.locator('#press-caption')).toHaveText('Second page');
 await page.locator('#press-next').click();await expect(page.locator('#press-caption')).toHaveText('Third page');await expect(page.locator('#press-next')).toBeDisabled();
 await expect(page.locator('#press-full-image')).toBeVisible();await page.screenshot({path:info.outputPath('press-viewer.png')});
 await page.locator('#press-prev').click();await expect(page.locator('#press-caption')).toHaveText('Second page');
 await page.keyboard.press('Escape');await expect(page.locator('#press-viewer')).not.toBeVisible();
 await page.screenshot({path:info.outputPath('press-article.png'),fullPage:true});
 await page.goto(`/press.html?article=${draft}`);await expect(page.locator('#press-status')).toContainText('not available');
 await page.goto('/press.html?article=other');await expect(page.locator('#press-article')).toContainText('No scans have been added');
});
test('Press Archive recovers from unavailable services and failed scans',async({page,backend})=>{
 await page.goto('/press.html');await expect(page.locator('#press-status')).toContainText('first clippings');
 backend.pressFailure=true;await page.reload();await expect(page.locator('#press-retry')).toBeVisible();
 seed(backend);backend.pressFailure=false;await page.locator('#press-retry').click();await expect(page.locator('.press-card')).toHaveCount(3);
 backend.pressImageFailure=true;await page.goto(`/press.html?article=${id}`);await page.locator('.press-pages button').first().click();await expect(page.locator('#press-image-retry')).toBeVisible();
 backend.pressImageFailure=false;await page.locator('#press-image-retry').click();await expect(page.locator('#press-full-image')).toBeVisible();await page.locator('#press-close').click();await expect(page.locator('#press-viewer')).not.toBeVisible();
});
test('Press admin saves drafts, uploads pages, edits order and publishes then unpublishes',async({page,backend},info)=>{
 await login(page);await expect(page.locator('#ap-status')).toContainText('Choose an article');
 await page.locator('#ap-title').fill('New clipping');await page.locator('#ap-publication').fill('Fixture newspaper');await page.locator('#ap-language').fill('Danish');await page.locator('#ap-publication_date').fill('1987-04-14');
 await page.locator('#ap-description').fill('Min beskrivelse');await page.locator('#ap-notes').fill('My scrapbook');
 backend.pressWriteFailure=true;await page.getByRole('button',{name:'SAVE ARTICLE',exact:true}).click();await expect(page.locator('#ap-status')).toContainText('Fixture press write failure');await expect(page.locator('#ap-title')).toHaveValue('New clipping');
 backend.pressWriteFailure=false;await page.getByRole('button',{name:'SAVE ARTICLE',exact:true}).click();await expect(page.locator('#ap-status')).toContainText('Draft saved');expect(backend.pressArticles[0].year).toBe(1987);expect(backend.pressArticles[0].published).toBe(false);
 for(const caption of ['Page one','Page two','Page three']){
  await page.locator('#ap-file').setInputFiles({name:'scan.png',mimeType:'image/png',buffer:png});await page.locator('#ap-caption').fill(caption);await page.getByRole('button',{name:'ADD SCAN',exact:true}).click();await expect(page.locator('#ap-status')).toContainText('Scan added');
 }
 await expect(page.locator('#ap-photos figure')).toHaveCount(3);
 const first=page.locator('#ap-photos figure').first();await first.locator('textarea').fill('Last page');await first.locator('input').fill('9');await first.getByRole('button').click();await expect(page.locator('#ap-status')).toContainText('Caption and order saved');
 await page.locator('#ap-published').check();await page.getByRole('button',{name:'SAVE ARTICLE',exact:true}).click();await expect(page.locator('#ap-status')).toHaveText('Article published.');
 await page.locator('#press-admin').screenshot({path:info.outputPath('press-admin.png')});
 const articleId=backend.pressArticles[0].id;await page.goto(`/press.html?article=${articleId}`);await expect(page.locator('.press-pages button')).toHaveText(['PAGE 1 — Page two','PAGE 2 — Page three','PAGE 3 — Last page']);
 await page.goto('/admin.html');await page.locator('#ap-select').selectOption(articleId);await expect(page.locator('#ap-photos img')).toHaveCount(3);
 await page.locator('#ap-published').uncheck();await page.getByRole('button',{name:'SAVE ARTICLE',exact:true}).click();await expect(page.locator('#ap-status')).toContainText('Draft saved');
 await page.goto(`/press.html?article=${articleId}`);await expect(page.locator('#press-status')).toContainText('not available');
});
test('Press admin rejects invalid scans and retains uploaded files on uncertain metadata writes',async({page,backend})=>{
 seed(backend);await login(page);await page.locator('#ap-select').selectOption(draft);await expect(page.locator('#ap-album')).toBeVisible();
 await page.locator('#ap-file').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByRole('button',{name:'ADD SCAN'}).click();await expect(page.locator('#ap-status')).toContainText('Choose a JPEG');expect(backend.writes.filter(w=>w.path.startsWith('/storage/'))).toHaveLength(0);
 backend.pressWriteFailure=true;await page.locator('#ap-file').setInputFiles({name:'scan.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'ADD SCAN'}).click();await expect(page.locator('#ap-status')).toContainText('retained in Storage');expect(backend.pressPages).toHaveLength(4);expect(backend.writes.filter(w=>w.method==='DELETE')).toHaveLength(0);
 await page.locator('#logout-button').click();await expect(page.locator('#ap-title')).toHaveValue('');await expect(page.locator('#editor-panel')).toBeHidden();
});
