import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildQuery, mapRelease} from '../supabase/functions/music-lookup/core.mjs';

test('barcode preserves zeros and rejects invalid inputs',()=>{
 assert.equal(buildQuery('barcode','0 01234567890'),'barcode:001234567890');
 assert.throws(()=>buildQuery('barcode','abc'));
 assert.throws(()=>buildQuery('anything','x'));
 assert.throws(()=>buildQuery('title','x'.repeat(161)));
 assert.equal(buildQuery('catalog','EMC 3411'),'catno:"EMC 3411"');
 assert.equal(buildQuery('title','Rio" OR *'),'release:"Rio\\" OR \\*"');
});
test('maps edition-specific identifiers without guessing vinyl is LP',()=>{
 const data={id:'d133c53f-2144-4152-a490-1a2c8c560f1c', title:'Rio', 'artist-credit':[{name:'Duran Duran'}], media:[{format:'Vinyl'}], 'label-info':[{label:{name:'EMI'},'catalog-number':'EMC 3411'}], barcode:'001234567890',date:'1982-05-10',country:'GB'};
 const release=mapRelease(data);
 assert.equal(release.artist,'Duran Duran');assert.equal(release.catalog_number,'EMC 3411');assert.equal(release.barcode,'001234567890');assert.equal(release.year,'1982');assert.equal(release.format,'Vinyl');assert.equal(mapRelease({}).barcode,'');
});
let handler;
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://test.example',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'secret',MUSICBRAINZ_CONTACT:'https://test.example'})[key]},serve:fn=>handler=fn};
await import('../supabase/functions/music-lookup/index.ts');
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
const request=()=>new Request('https://test.example/functions/v1/music-lookup',{method:'POST',headers:{Authorization:'Bearer session'},body:JSON.stringify({mode:'catalog',value:'EMC 3411'})});
test('rejects non-admin users before external requests',async()=>{
 const calls=[];globalThis.fetch=async url=>{calls.push(url);return response(url.endsWith('/user')?{id:'user'}:false);};
 assert.equal((await handler(request())).status,403);assert.equal(calls.length,2);
});
test('uses cached result without MusicBrainz call',async()=>{
 globalThis.fetch=async url=>{if(url.endsWith('/user'))return response({id:'user'});if(url.includes('is_neocache_admin'))return response(true);if(url.includes('music_lookup_cache'))return response([{payload:{releases:[],total:0}}]);throw Error('Unexpected request');};
 assert.deepEqual(await (await handler(request())).json(),{releases:[],total:0});
});
test('throttle stops upstream calls',async()=>{
 globalThis.fetch=async url=>{if(url.endsWith('/user'))return response({id:'user'});if(url.includes('is_neocache_admin'))return response(true);if(url.includes('music_lookup_cache'))return response([]);if(url.includes('claim_music_lookup'))return response(false);throw Error('Unexpected request');};
 assert.equal((await handler(request())).status,429);
});
test('uncached query maps and caches upstream result',async()=>{
 let saved=false;
 globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/user'))return response({id:'user'});
 if(url.includes('is_neocache_admin')||url.includes('claim_music_lookup'))return response(true);
 if(url.includes('music_lookup_cache')){if(options.method==='POST'){saved=true;assert.equal(JSON.parse(options.body).payload.releases[0].title,'Rio');}return response([]);}
 assert.match(url,/musicbrainz.org/);assert.match(options.headers['User-Agent'],/NeoCache/);
 return response({count:1,releases:[{title:'Rio'}]});
 };
 assert.equal((await (await handler(request())).json()).releases[0].title,'Rio');assert(saved);
});
