import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(status=200){
 const calls=[];
 const context=vm.createContext({NEOCACHE_CONFIG:{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLIC_KEY:'public-fixture'},URL:{createObjectURL:()=> 'blob:fixture'},
  fetch:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,blob:async()=>new Blob(['fixture']),json:async()=>[]};}});
 vm.runInContext(fs.readFileSync('memory-core.js','utf8'),context);
 return {api:context.NeoMemory,calls};
}
test('memory photo downloads apply client credentials without public URLs or browser caching',async()=>{
 const {api,calls}=setup();const path='11111111-1111-4111-8111-111111111111/photo.png';
 assert.equal(await api.photo(path),'blob:fixture');await api.photo(path,'admin-fixture');
 assert.equal(calls[0].url,`https://fixture.invalid/storage/v1/object/memories/${path}`);
 assert.equal(calls[0].options.headers.Authorization,'Bearer public-fixture');assert.equal(calls[1].options.headers.Authorization,'Bearer admin-fixture');
 assert.equal(calls[0].options.cache,'no-store');
});
test('memory photo paths reject traversal and external URLs before making requests',async()=>{
 const {api,calls}=setup();
 for(const path of ['../photo.png','https://example.invalid/photo.png','1111/../photo.png','1111/photo.svg','1111/a.png?query=1'])await assert.rejects(api.photo(path),/Invalid memory photo path/);
 assert.equal(calls.length,0);
});
test('failed memory reads reject instead of presenting an empty collection',async()=>{
 const {api}=setup(403);await assert.rejects(api.read('memories?select=*'),/403/);
});
