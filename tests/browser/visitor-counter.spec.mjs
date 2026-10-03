import {test, expect} from './fixtures.mjs';

test('visits persist across reloads and every public page; new sessions count', async ({page, backend}, testInfo) => {
  for (const name of ['index', 'music', 'books', 'comics', 'rooms', 'about', 'tour']) {
    await page.goto(`/${name}.html`);
    await expect(page.locator('#visitor-count')).toHaveText('1,235');
  }
  await page.reload();
  await expect(page.locator('#visitor-count')).toHaveText('1,235');
  expect(backend.visitIds.size).toBe(1);
  await page.evaluate(() => sessionStorage.removeItem('neocache-visit-v1'));
  await page.reload();
  await expect(page.locator('#visitor-count')).toHaveText('1,236');
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.screenshot({path: testInfo.outputPath('counter-footer.png')});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const calls = backend.visitCalls.length;
  await page.goto('/admin.html');
  await expect(page.locator('#login-email')).toBeVisible();
  expect(backend.visitCalls.length).toBe(calls);
});

test('counter outage leaves content usable and retries the same session', async ({page, backend}) => {
  backend.counterFailure = true;
  await page.goto('/books.html');
  await expect(page.locator('.item-card')).toHaveCount(1);
  await expect.poll(() => backend.visitCalls.length).toBe(1);
  await expect(page.locator('#visitor-count')).toHaveText('—');
  const id = backend.visitCalls[0].p_visit_id;
  backend.counterFailure = false;
  await page.reload();
  await expect(page.locator('#visitor-count')).toHaveText('1,235');
  expect(backend.visitCalls[1].p_visit_id).toBe(id);
});

test('blocked session storage reads the total without counting every page', async ({page, backend}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {get() {throw new Error('Storage blocked');}});
  });
  await page.goto('/about.html');
  await expect(page.locator('#visitor-count')).toHaveText('1,234');
  await page.reload();
  await expect(page.locator('#visitor-count')).toHaveText('1,234');
  expect(backend.visitIds.size).toBe(0);
});
