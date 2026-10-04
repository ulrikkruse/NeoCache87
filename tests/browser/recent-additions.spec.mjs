import {test,expect} from './fixtures.mjs';

test('New Signal marks only registrations within the last 14 days across collections',async({page,backend})=>{
 const now=new Date('2026-10-04T12:00:00Z');
 await page.clock.setFixedTime(now);
 const day=24*60*60*1000;
 for(const item of backend.items)item.created_at=new Date(now.getTime()-14*day).toISOString();
 backend.items.find(item=>item.id==='merch').created_at=new Date(now.getTime()-14*day-1).toISOString();
 for(const path of ['index','music','books','comics']){
  await page.goto(`/${path}.html`);
  await expect(page.locator('#item-grid .new-signal')).toHaveCount(1);
 }
 const item=backend.items.find(item=>item.id==='book');
 await page.goto('/books.html');
 for(const date of [new Date(now.getTime()-14*day-1).toISOString(),new Date(now.getTime()+1).toISOString(),'invalid']){
  item.created_at=date;await page.reload();
  await expect(page.locator('#item-grid .item-card')).toHaveCount(1);
  await expect(page.locator('#item-grid .new-signal')).toHaveCount(0);
 }
});

test('recent additions span collections, exclude rooms, sort by registration and open dossiers',async({page,backend},testInfo)=>{
 const dates={computer:'2026-01-01',merch:'2026-01-02',music:'2026-01-06',book:'2026-01-05',comic:'2026-01-04',room:'2026-01-09'};
 for(const item of backend.items)item.created_at=dates[item.id]+'T12:00:00Z';
 backend.items.push({id:'undated',title:'Undated artifact',type:'Computer',images:[]});
 backend.items.find(item=>item.id==='comic').images=[];
 await page.goto('/index.html');
 const section=page.locator('#recent-additions');
 await expect(section.locator('.recent-title')).toHaveText(['Rio','Absence','Watchmen','Tour shirt']);
 await expect(section.locator('time').first()).toHaveText('06 Jan 2026');
 await expect(section.locator('.recent-thumbnail').nth(2)).toHaveText('N/87');
 await page.locator('#search-filter').fill('no matches');
 await expect(page.locator('#item-grid .item-card')).toHaveCount(0);
 await expect(section.locator('a')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.screenshot({path:testInfo.outputPath('recent-additions.png')});
 for(const [title,path] of [['Rio','music'],['Absence','books'],['Watchmen','comics'],['Tour shirt','index']]){
  await page.goto('/index.html');
  await page.locator('#recent-additions').getByRole('link').filter({hasText:title}).click();
  await expect(page).toHaveURL(new RegExp(`/${path}\\.html\\?item=`));
  await expect(page.locator('#detail-title')).toHaveText(title);
  await expect(page.locator('#item-detail')).toBeVisible();
 }
});

test('recent additions hide without dated records and work with an empty Archive',async({page,backend})=>{
 await page.goto('/index.html');
 await expect(page.locator('#filters')).toBeVisible();
 await expect(page.locator('#recent-additions')).toBeHidden();
 backend.items.splice(0,backend.items.length,{id:'only-book',title:'Only book',category:'Books',created_at:'2026-01-01T12:00:00Z',images:[]});
 await page.reload();
 await expect(page.locator('#recent-additions .recent-title')).toHaveText('Only book');
 await expect(page.locator('#status')).toContainText('The archive is empty');
 await page.goto('/books.html');
 await expect(page.locator('#item-grid .item-card')).toHaveCount(1);
 await expect(page.locator('#recent-additions')).toHaveCount(0);
});
