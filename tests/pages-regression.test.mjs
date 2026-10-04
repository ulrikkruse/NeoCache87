import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const pages=['index','music','books','comics','rooms'];
for(const page of [...pages,'admin','about','tour','memories']) {
 test(`${page}: local assets exist and element IDs are unique`,()=>{
 const html=fs.readFileSync(`${page}.html`,'utf8');
 const ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(/^(?:[a-z]+:|#|\/\/)/i.test(url))continue;
 const target=url.split(/[?#]/)[0];if(target)assert(fs.existsSync(path.resolve(target)),`${page}: missing ${target}`);
 }
 // Every literal document ID lookup in the page's scripts must bind to real markup.
 for(const [,script] of html.matchAll(/<script[^>]*src="([^"?]+)[^"]*"/g)){
 for(const [,id] of fs.readFileSync(script,'utf8').matchAll(/document\.querySelector\(["']#([\w-]+)["']\)/g)){
 // Recently added is a homepage-only feature, guarded by collectionPage in app.js.
 if(script==='app.js' && ['recent-additions','recent-list'].includes(id) && page!=='index'){
  assert(!ids.includes(id),`${page}: homepage-only section must stay on index`);
  continue;
 }
 assert(ids.includes(id),`${page}: ${script} expects #${id}`);
 }
 }
 });
}
for(const page of pages) {
 test(`${page}: shared navigation, Database Link and working Origin Signal are present`,()=>{
 const html=fs.readFileSync(`${page}.html`,'utf8');
 const nav=html.match(/<nav class="collection-nav"[\s\S]*?<\/nav>/)?.[0];assert(nav);
 for(const target of pages)assert(nav.includes(`href="${target}.html"`));
 assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
 assert(nav.includes(`href="${page}.html" aria-current="page"`));
 assert.match(html,/class="system-status"[^>]*>[\s\S]*?DATABASE LINK/);
 for(const id of ['origin-trigger','origin-transmission','close-origin'])assert(html.includes(`id="${id}"`));
 const script=fs.readFileSync(page==='rooms'?'rooms.js':'app.js','utf8');assert.match(script,/originDialog\.showModal\(\)/);assert.match(script,/originDialog\.close\(\)/);
 });
}
test('collection pages reference the same version of the shared app and stylesheet',()=>{
 const contents=pages.map(p=>fs.readFileSync(`${p}.html`,'utf8'));
 assert.equal(new Set(contents.map(s=>s.match(/href="(style.css[^\"]*)"/)[1])).size,1);
 assert.equal(new Set(contents.slice(0,4).map(s=>s.match(/src="(app.js[^\"]*)"/)[1])).size,1);
});
