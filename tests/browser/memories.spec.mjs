import {test,expect,login,png} from './fixtures.mjs';
const id='11111111-1111-4111-8111-111111111111';
const draft='22222222-2222-4222-8222-222222222222';
function seed(backend){
 backend.memories.push({id,title:'A walk through town',period:'Mid-eighties',place:'Fixture town',theme:'Childhood',body:'A synthetic memory.\n\nThe second paragraph <script>alert(1)</script>.',published:true,related_item_id:'book'},
  {id:draft,title:'Private draft',period:'1987',place:'',theme:'',body:'Not published',published:false,related_item_id:null});
 backend.memoryPhotos.push({id:'p1',memory_id:id,path:`${id}/one.png`,caption:'The square',position:0},{id:'p2',memory_id:id,path:`${id}/two.png`,caption:'The school',position:1},
  {id:'p3',memory_id:draft,path:`${draft}/three.png`,caption:'Private photograph',position:0});
}
test('Memory Lane lists published memories, reads albums and links both directions',async({page,backend},info)=>{
 seed(backend);await page.goto('/index.html');await page.getByRole('link',{name:'MEMORY LANE'}).click();
 await expect(page.locator('.memory-card')).toHaveCount(1);await expect(page.getByText('Private draft')).toHaveCount(0);
 await page.getByRole('link',{name:'A walk through town'}).click();
 await expect(page.locator('.memory-album img')).toHaveCount(2);await expect(page.locator('.memory-body')).toContainText('<script>alert(1)</script>');
 await expect(page.locator('.memory-meta')).toHaveText('Mid-eighties · Fixture town · Childhood');
 await expect(page.locator('.memory-album figcaption')).toHaveText(['The square','The school']);
 await expect.poll(()=>page.locator('.memory-album img').first().evaluate(img=>img.naturalWidth)).toBe(900);
 await expect(page.locator('.memory-body')).toHaveCSS('color','rgb(244, 240, 255)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('memory-story.png'),fullPage:true});
 await page.getByRole('link',{name:'OPEN DOSSIER: Absence'}).click();await expect(page.locator('#detail-title')).toHaveText('Absence');
 await page.getByRole('link',{name:'RELATED MEMORIES'}).click();await expect(page.locator('.memory-card')).toHaveCount(1);
 await page.goto(`/memories.html?memory=${draft}`);await expect(page.locator('#memory-status')).toContainText('not available');await expect(page.locator('#memory-story')).toBeHidden();
});
test('Memory Lane handles empty, service and image failures with recovery',async({page,backend})=>{
 await page.goto('/memories.html');await expect(page.locator('#memory-status')).toContainText('first memories');
 backend.memoryFailure=true;await page.reload();await expect(page.locator('#memory-retry')).toBeVisible();
 backend.memoryFailure=false;seed(backend);backend.memoryImageFailure=true;await page.locator('#memory-retry').click();await expect(page.getByText('Photograph unavailable.',{exact:false})).toHaveCount(1);
 backend.memoryImageFailure=false;await page.locator('#memory-retry').click();await expect(page.locator('.memory-card img')).toHaveCount(1);
 await page.goto('/memories.html?item=computer');await expect(page.locator('#memory-status')).toContainText('No published memories');
});
test('Memory Lane follows pagination for memories and albums and orders the cover',async({page,backend})=>{
 seed(backend);
 backend.memories.push(...['Third memory','Fourth memory'].map((title,i)=>({...backend.memories[0],id:`extra-${i}`,title})));
 backend.memoryPhotos.push({id:'p4',memory_id:id,path:`id-placeholder`,caption:'An earlier photo',position:0});
 backend.memoryPhotos[3].path=`${id}/four.png`;backend.memoryPhotos[0].position=2;
 await page.goto('/memories.html');await expect(page.locator('.memory-card')).toHaveCount(3);
 await expect(page.locator('.memory-card img').first()).toHaveAttribute('alt','An earlier photo');
 await page.getByRole('link',{name:'A walk through town'}).click();await expect(page.locator('.memory-album figcaption')).toHaveText(['An earlier photo','The school','The square']);
});
test('admin saves a draft, adds a captioned photograph, publishes and unpublishes',async({page,backend},info)=>{
 await login(page);await expect(page.locator('#am-status')).toContainText('Choose a memory');
 await page.locator('#am-title').fill('My first computer');await page.locator('#am-period').fill('1986');await page.locator('#am-place').fill('Fixture town');
 await page.locator('#am-body').fill('A synthetic childhood story.');await page.locator('#am-item').selectOption('computer');
 backend.memoryWriteFailure=true;await page.getByRole('button',{name:'SAVE MEMORY',exact:true}).click();await expect(page.locator('#am-status')).toContainText('Fixture memory write failure');
 await expect(page.locator('#am-body')).toHaveValue('A synthetic childhood story.');expect(backend.memories).toHaveLength(0);
 backend.memoryWriteFailure=false;await page.getByRole('button',{name:'SAVE MEMORY',exact:true}).click();await expect(page.locator('#am-status')).toContainText('Draft saved');
 expect(backend.memories[0].published).toBe(false);
 await page.locator('#am-file').setInputFiles({name:'childhood.png',mimeType:'image/png',buffer:png});await page.locator('#am-caption').fill('My old desk');
 await page.getByRole('button',{name:'ADD PHOTOGRAPH',exact:true}).click();await expect(page.locator('#am-status')).toContainText('Photograph added');
 expect(backend.memoryPhotos[0].caption).toBe('My old desk');expect(backend.writes.some(w=>w.path.startsWith('/storage/v1/object/memories/'))).toBe(true);
 await page.locator('#am-photos textarea').fill('My desk in 1986');await page.getByRole('button',{name:'SAVE CAPTION / ORDER'}).click();await expect(page.locator('#am-status')).toContainText('Caption and order saved');
 await page.locator('#am-published').check();await page.getByRole('button',{name:'SAVE MEMORY',exact:true}).click();await expect(page.locator('#am-status')).toHaveText('Memory published.');
 await page.locator('#memory-admin').screenshot({path:info.outputPath('memory-admin.png')});
 const memoryId=backend.memories[0].id;await page.goto(`/memories.html?memory=${memoryId}`);await expect(page.locator('.memory-album figcaption')).toHaveText('My desk in 1986');
 await page.goto('/admin.html');await page.locator('#am-select').selectOption(memoryId);await expect(page.locator('#am-photos img')).toHaveCount(1);
 await page.locator('#am-published').uncheck();await page.getByRole('button',{name:'SAVE MEMORY',exact:true}).click();await expect(page.locator('#am-status')).toContainText('Draft saved');
 await page.goto(`/memories.html?memory=${memoryId}`);await expect(page.locator('#memory-status')).toContainText('not available');
});
test('admin rejects invalid uploads and keeps uploaded file on uncertain record failure',async({page,backend})=>{
 seed(backend);await login(page);await page.locator('#am-select').selectOption(draft);await expect(page.locator('#am-album')).toBeVisible();
 await page.locator('#am-file').setInputFiles({name:'wrong.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await page.getByRole('button',{name:'ADD PHOTOGRAPH'}).click();await expect(page.locator('#am-status')).toContainText('Choose a JPEG');
 expect(backend.writes.filter(w=>w.path.startsWith('/storage/'))).toHaveLength(0);
 backend.memoryWriteFailure=true;await page.locator('#am-file').setInputFiles({name:'valid.png',mimeType:'image/png',buffer:png});
 await page.getByRole('button',{name:'ADD PHOTOGRAPH'}).click();await expect(page.locator('#am-status')).toContainText('retained in Storage');
 expect(backend.memoryPhotos).toHaveLength(3);expect(backend.writes.filter(w=>w.method==='DELETE')).toHaveLength(0);
 await page.locator('#logout-button').click();await expect(page.locator('#editor-panel')).toBeHidden();await expect(page.locator('#am-body')).toHaveValue('');
});
