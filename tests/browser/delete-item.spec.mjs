import {test,expect,login} from './fixtures.mjs';
function setup(backend){
 const original=backend.items.find(item=>item.id==='merch');original.title='Smurf stickers';
 backend.items.push({...structuredClone(original),id:'duplicate-smurf'});
}
async function routeDelete(page,backend,{fail=false,empty=false}={}){
 await page.route('https://fixture.invalid/rest/v1/items?**',async route=>{
  const request=route.request();if(request.method()!=='DELETE')return route.fallback();
  expect(request.headers().authorization).toBe('Bearer fixture-session');
  const id=new URL(request.url()).searchParams.get('id');
  backend.writes.push({path:'/rest/v1/items',method:'DELETE',id});
  if(fail)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Fixture deletion failed'})});
  const index=backend.items.findIndex(item=>'eq.'+item.id===id);
  const rows=empty||index<0?[]:backend.items.splice(index,1).map(item=>({id:item.id}));
  return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)});
 });
}
test('Archive deletion confirms exact duplicate, supports cancellation and keeps the other copy',async({page,backend},info)=>{
 setup(backend);await routeDelete(page,backend);await login(page);
 await page.locator('#existing-item-search').fill('Smurf');await expect(page.locator('#existing-item option')).toHaveCount(3);
 await page.locator('#existing-item').selectOption('duplicate-smurf');await expect(page.locator('#delete-item-preview')).toBeVisible();await expect(page.locator('#delete-item-open')).toHaveAttribute('href','index.html?item=duplicate-smurf');
 await page.locator('#delete-item-button').click();await expect(page.locator('#delete-confirm-summary')).toContainText('duplicate-smurf');await expect(page.locator('#delete-item-cancel')).toBeFocused();
 await page.locator('#delete-item-dialog').screenshot({path:info.outputPath('delete-confirm.png')});
 await page.locator('#delete-item-cancel').click();expect(backend.writes).toHaveLength(0);
 await page.locator('#delete-item-button').click();await page.keyboard.press('Escape');await expect(page.locator('#delete-item-dialog')).not.toBeVisible();expect(backend.writes).toHaveLength(0);
 await page.locator('.tag-maintenance').screenshot({path:info.outputPath('delete-panel.png')});
 await page.locator('#delete-item-button').click();await page.locator('#delete-item-confirm').click();await expect(page.locator('#delete-item-status')).toContainText('Deleted “Smurf stickers”');
 await expect(page.locator('#existing-item option[value="duplicate-smurf"]')).toHaveCount(0);expect(backend.items.some(item=>item.id==='merch')).toBe(true);
 expect(backend.writes).toEqual([{path:'/rest/v1/items',method:'DELETE',id:'eq.duplicate-smurf'}]);
 await page.goto('/index.html');await expect(page.locator('.item-card').filter({hasText:'Smurf stickers'})).toHaveCount(1);
});
for(const mode of ['error','no returned row'])test(`deletion ${mode} never reports success or removes local selection`,async({page,backend})=>{
 setup(backend);await routeDelete(page,backend,{fail:mode==='error',empty:mode!=='error'});await login(page);await page.locator('#existing-item').selectOption('duplicate-smurf');
 await page.locator('#delete-item-button').click();await page.locator('#delete-item-confirm').click();await expect(page.locator('#delete-item-status')).toContainText('Could not confirm deletion');await expect(page.locator('#delete-item-status')).not.toContainText('Deleted “');
 await expect(page.locator('#existing-item')).toHaveValue('duplicate-smurf');expect(backend.items.some(item=>item.id==='duplicate-smurf')).toBe(true);await expect(page.locator('#delete-item-button')).toBeEnabled();
});
test('delete action is Archive-only and closes on logout',async({page,backend})=>{
 await login(page);await expect(page.locator('#delete-item-panel')).toBeHidden();
 for(const id of ['music','book','comic','room']){await page.locator('#existing-item').selectOption(id);await expect(page.locator('#delete-item-panel')).toBeHidden();}
 await page.locator('#existing-item').selectOption('computer');await expect(page.locator('#delete-item-panel')).toBeVisible();await page.locator('#delete-item-button').click();await page.locator('#delete-item-cancel').click();
 await page.locator('#logout-button').click();await expect(page.locator('#delete-item-panel')).toBeHidden();await expect(page.locator('#delete-item-dialog')).not.toBeVisible();expect(backend.writes).toHaveLength(0);
});
