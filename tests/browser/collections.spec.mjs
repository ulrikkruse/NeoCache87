import {test,expect} from './fixtures.mjs';
for(const [pageName,titles] of [['index',['Amiga','Tour shirt']],['music',['Rio']],['books',['Absence']],['comics',['Watchmen']]]){
 test(`${pageName}: collection, navigation, origin and responsive layout`,async({page,backend})=>{
  await page.goto(`/${pageName}.html`);
  await expect(page.locator('.item-card')).toHaveCount(titles.length);
  for(const title of titles)await expect(page.locator('.item-card').getByRole('heading',{name:title,exact:true})).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Collections'});
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href',`${pageName}.html`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'ORIGIN SIGNAL',exact:true}).click();
  await expect(page.locator('#origin-transmission')).toBeVisible();
  await page.getByRole('button',{name:'Close origin transmission'}).click();await expect(page.locator('#origin-transmission')).not.toBeVisible();
  await nav.getByRole('link',{name:'THE ROOMS',exact:true}).click();await expect(page).toHaveURL(/rooms.html$/);
  await expect(page.locator('.room-photo')).toHaveCount(2);
  await expect(page.locator('.system-status')).toHaveText(' DATABASE LINK');
  await page.getByRole('button',{name:'ORIGIN SIGNAL',exact:true}).click();await expect(page.locator('#origin-transmission')).toBeVisible();
 });
}
test('Hardback filter uses edited type and can be reset',async({page,backend})=>{
 await page.goto('/books.html');await expect(page.locator('#filters')).toBeVisible();
 await expect(page.locator('#type-filter option')).toHaveText(['ALL FORMATS','HARDBACK']);
 await page.locator('#type-filter').selectOption('Hardback');await expect(page.locator('.item-card')).toHaveCount(1);
 await page.locator('#search-filter').fill('missing');await expect(page.locator('.item-card')).toHaveCount(0);
 await page.getByRole('button',{name:'RESET SIGNAL'}).click();await expect(page.locator('.item-card')).toHaveCount(1);
 await page.locator('#search-filter').fill('9780140328721');await expect(page.locator('.item-card')).toHaveCount(1);
});
test('music search combines artist, format and catalog number',async({page,backend})=>{
 await page.goto('/music.html');await expect(page.locator('#filters')).toBeVisible();
 await page.locator('#category-filter').selectOption('Duran Duran');await page.locator('#type-filter').selectOption('LP');await page.locator('#search-filter').fill('emc 3411');await expect(page.locator('.item-card')).toHaveCount(1);
 await expect(page.locator('#type-filter option')).not.toContainText(['MERCH']);
});
test('image gallery navigation and item deep link',async({page,backend})=>{
 await page.goto('/books.html');await page.getByRole('button',{name:'View full image of Absence'}).click();
 await expect(page.locator('#lightbox-image')).toHaveAttribute('src',/front.png$/);
 await page.getByRole('button',{name:'Next image'}).click();await expect(page.locator('#lightbox-image')).toHaveAttribute('src',/back.png$/);
 await page.getByRole('button',{name:'Close image viewer'}).click();
 await page.getByRole('button',{name:'Open details for Absence'}).click();await expect(page.locator('#item-detail')).toBeVisible();await expect(page).toHaveURL(/item=book/);
 await page.reload();await expect(page.locator('#item-detail')).toBeVisible();await expect(page.locator('#detail-title')).toHaveText('Absence');
});
test('Rooms filters and photo viewer',async({page,backend})=>{
 await page.goto('/rooms.html');await expect(page.locator('.room-photo')).toHaveCount(2);
 await page.getByRole('button',{name:'HOME CINEMA',exact:true}).click();await expect(page.locator('.room-photo')).toHaveCount(0);
 await page.getByRole('button',{name:'80S ROOM',exact:true}).click();await expect(page.locator('.room-photo')).toHaveCount(2);
 await page.locator('.room-photo').first().click();await expect(page.locator('#room-viewer')).toBeVisible();await page.getByRole('button',{name:'Next photo'}).click();await expect(page.locator('#photo-position')).toHaveText('2 / 2');
});
