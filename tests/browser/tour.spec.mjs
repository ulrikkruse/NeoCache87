import {test,expect,login} from './fixtures.mjs';
const scene={id:'view-one',title:'The retro corner',image_path:'room-tour/full.jpg',preview_path:'room-tour/preview.jpg',published:true};
async function seed(page,backend){
 backend.scenes.push({...scene},{...scene,id:'view-two',title:'Another angle'});
 backend.tourPoints.push(...['computer','music','book','comic','merch','room'].map((id,i)=>({id:'p'+i,scene_id:scene.id,item_id:id,x:15+i*12,y:40})));
 await page.route('**/storage/v1/object/public/images/room-tour/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="#111629"/><path d="M0 500H1200M250 0V700M650 0V700M1000 0V700" stroke="#2fffe0" stroke-width="3"/><rect x="70" y="240" width="290" height="240" fill="#353059"/><rect x="700" y="160" width="190" height="300" fill="#61324d"/><text x="45" y="80" fill="#a4bbd2" font-size="32">SYNTHETIC ROOM / TEST FIXTURE</text></svg>'}));
}
test('tour preview, zoom, markers, linked collections and responsive layout',async({page,backend},info)=>{
 await seed(page,backend);const originals=[];page.on('request',r=>{if(r.url().endsWith('/full.jpg'))originals.push(r.url());});
 await page.goto('/rooms.html');await page.getByRole('link',{name:'EXPLORE THE ROOM'}).click();
 await expect(page.locator('#tour-photo')).toHaveAttribute('src',/preview.jpg$/);
 await expect(page.locator('.tour-point')).toHaveCount(5);expect(originals).toHaveLength(0);
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('#tour-zoom')).toHaveText('150%');
 await expect(page.locator('#tour-photo')).toHaveAttribute('src',/full.jpg$/);
 await page.getByRole('button',{name:'SHOW MARKERS'}).click();await expect(page.locator('#tour-points')).toBeHidden();
 for(const [title,collection] of [['Amiga','index'],['Rio','music'],['Absence','books'],['Watchmen','comics'],['Tour shirt','index']]){
  await page.locator('#tour-items').getByRole('button',{name:title,exact:true}).click();
  await expect(page.locator('#tour-item-title')).toHaveText(title);
  await expect(page.locator('#tour-item-link')).toHaveAttribute('href',new RegExp('^'+collection+'\\.html\\?item='));
 }
 await page.getByRole('button',{name:'RESET VIEW'}).click();await expect(page.locator('#tour-zoom')).toHaveText('100%');
 await page.getByRole('button',{name:'SHOW MARKERS'}).click();
 await page.locator('.tour-point').first().click();await expect(page.locator('#tour-item-title')).toHaveText('Amiga');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('tour.png'),fullPage:true});
 await page.locator('#tour-item-link').click();await expect(page.locator('#detail-title')).toHaveText('Amiga');
 await page.goto('/tour.html?scene=view-two');await expect(page.locator('#tour-scene')).toHaveValue('view-two');await expect(page.locator('.tour-point')).toHaveCount(0);
});
test('tour empty, service failure and failed high resolution preserve recovery',async({page,backend})=>{
 await page.goto('/tour.html');await expect(page.locator('#tour-status')).toContainText('being prepared');
 backend.tourFailure=true;await page.reload();await expect(page.locator('#tour-retry')).toBeVisible();
 backend.tourFailure=false;await seed(page,backend);await page.locator('#tour-retry').click();
 await page.route('**/room-tour/full.jpg',route=>route.fulfill({status:404,body:'missing'}));
 await page.locator('#tour-hd').click();await expect(page.locator('#tour-image-status')).toContainText('could not load');
 await expect(page.locator('#tour-photo')).toHaveAttribute('src',/preview.jpg$/);await expect(page.locator('#tour-hd')).toBeEnabled();
});
test('admin places, updates and removes a marker; publishes and reloads settings',async({page,backend},info)=>{
 await seed(page,backend);await login(page);await page.locator('#at-scene').selectOption(scene.id);
 await expect(page.locator('#at-edit')).toBeVisible();await expect(page.locator('#at-photo')).toBeVisible();
 await page.locator('#at-photo').click({position:{x:10,y:10}});
 await expect(page.locator('#at-x')).not.toHaveValue('');await page.locator('#at-search').fill('Absence');await page.locator('#at-item').selectOption('book');
 await page.locator('#at-x').fill('32.5');await page.locator('#at-y').fill('60');
 await page.getByRole('button',{name:'SAVE MARKER',exact:true}).click();await expect(page.locator('#at-status')).toHaveText('Marker saved.');
 expect(backend.tourPoints.find(p=>p.item_id==='book').x).toBe(32.5);
 backend.tourWriteFailure=true;await page.locator('#at-x').fill('55');await page.getByRole('button',{name:'SAVE MARKER',exact:true}).click();
 await expect(page.locator('#at-status')).toContainText('Could not save');expect(backend.tourPoints.find(p=>p.item_id==='book').x).toBe(32.5);
 backend.tourWriteFailure=false;await page.getByRole('button',{name:'Remove marker for Absence',exact:true}).click();
 await expect(page.locator('#at-status')).toContainText('Marker removed');expect(backend.items.some(i=>i.id==='book')).toBe(true);
 await page.locator('#at-published').uncheck();await page.getByRole('button',{name:'SAVE VIEW SETTINGS'}).click();await expect(page.locator('#at-status')).toHaveText('View settings saved.');
 await page.reload();await page.locator('#at-scene').selectOption(scene.id);await expect(page.locator('#at-published')).not.toBeChecked();
 await page.locator('#tour-admin').screenshot({path:info.outputPath('tour-admin.png')});
 await page.goto('/tour.html');await expect(page.locator('#tour-scene option')).toHaveText(['Another angle']);
});
test('admin uploads a separate original and preview as an unpublished view',async({page,backend})=>{
 await login(page);await expect(page.locator('#at-status')).toContainText('first room photograph');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=80;c.getContext('2d').fillRect(0,0,120,80);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#at-title').fill('New angle');await page.locator('#at-file').setInputFiles({name:'room.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.getByRole('button',{name:'UPLOAD TOUR VIEW'}).click();await expect(page.locator('#at-status')).toContainText('View saved as unpublished');
 expect(backend.scenes).toHaveLength(1);expect(backend.scenes[0].published).toBe(false);
 expect(backend.writes.filter(w=>w.path.startsWith('/storage/'))).toHaveLength(2);
 await page.locator('#at-search').fill('Amiga');await page.locator('#at-item').selectOption('computer');await page.locator('#at-x').fill('0');await page.locator('#at-y').fill('100');
 await page.getByRole('button',{name:'SAVE MARKER',exact:true}).click();await expect(page.locator('#at-status')).toHaveText('Marker saved.');
 expect(backend.tourPoints[0]).toMatchObject({x:0,y:100,item_id:'computer'});
});
