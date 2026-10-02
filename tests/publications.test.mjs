import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {valid,normalize,lookupPath,mapEdition,mapSearch} from '../supabase/functions/publication-lookup/core.mjs';
test('ISBN-10 and ISBN-13 checksums, prefixes and leading zeros',()=>{
 for(const value of ['9780140328721','0-14-032872-6','080442957X','9791090636071']) assert(valid(value),value);
 for(const value of ['9780140328722','5099969945120','1234567890','9771234567003']) assert(!valid(value),value);
 assert.equal(normalize('0-8044-2957-x'),'080442957X');
 assert.throws(()=>lookupPath('isbn','5099969945120'));
 assert.throws(()=>lookupPath('edition','https://example.com'));
 assert.match(lookupPath('series','Tintin 12'),/q=Tintin\+12/);
});
test('mapping preserves edition ISBN and year; missing details stay blank',()=>{
 const result=mapEdition({url:'https://openlibrary.org/books/OL123M/Test',title:'Test',identifiers:{isbn_10:['0140328726']},authors:[{name:'Author'}],publishers:[{name:'Publisher'}],publish_date:'June 1988'});
 assert.equal(result.openlibrary_id,'OL123M');assert.equal(result.isbn,'0140328726');assert.equal(result.year,'1988');assert.equal(result.format,'');assert.equal(result.illustrator,'');
 const hits=mapSearch({docs:[{title:'Series',author_name:['Author'],first_publish_year:1900,editions:{docs:[{key:'/books/OL123M',title:'Edition',publish_date:['2001']}]}}]});
 assert.equal(hits[0].date,'2001');assert(hits[0].needs_details);
});
test('all collections are disjoint, merch remains Archive',()=>{
 const ctx={document:{body:{classList:{contains:()=>false}}},window:{NEOCACHE_CONFIG:{}}};vm.createContext(ctx);
 const source=fs.readFileSync('app.js','utf8');vm.runInContext(source.slice(0,source.indexOf('const grid')),ctx);
 assert.equal(ctx.itemCollection({publication_details:{kind:'books'}}),'books');assert.equal(ctx.itemCollection({publication_details:{kind:'comics'}}),'comics');assert.equal(ctx.itemCollection({type:'LP'}),'music');assert.equal(ctx.itemCollection({type:'Merch',category:'Music'}),'archive');
});
test('publication save preserves issue identifiers and uses separate table',async()=>{
 for(const kind of ['books','comics']) {
 const values=new Map(Object.entries({record_kind:kind,title:'Book',folder:'books',year:'1988',publication_format:'Paperback',publication_isbn:'0-14-032872-6',publication_issue:'001'}));
 const calls=[];const source=fs.readFileSync('admin.js','utf8');
 const ctx={window:{NeoCacheISBN:{normalize,valid}},itemForm:{addEventListener:(e,h)=>ctx.submit=h,reset(){}},filesInput:{files:[{type:'image/jpeg',name:'cover.jpg'}]},saveButton:{},saveStatus:{},session:{user:{id:'owner'}},FormData:function(){return values;},slugify:x=>x,uniqueValues:x=>x.filter(Boolean),setStatus(){},uploadImage:async()=>{},deleteUploadedImage:async()=>{},discardIncompleteItem:async()=>assert.fail('Unexpected cleanup'),createTags:async()=>{},clearPreviews(){},syncRecordKind(){},refreshStorageFolders(){},loadEditorData:async()=>{},restRequest:async(path,opts)=>{calls.push(path);if(path==='items')return [{id:'id'}];if(path==='publication_details'){const body=JSON.parse(opts.body);assert.equal(body.kind,kind);assert.equal(body.isbn,'0140328726');assert.equal(body.issue,'001');}return [];}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('itemForm.addEventListener("submit"'),source.indexOf('\nif (!projectUrl')),ctx);await ctx.submit({preventDefault(){}});
 assert(calls.includes('publication_details'));assert(!calls.includes('music_details'));
 }
});
let handler;
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://test.example',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'secret'})[key]},serve:fn=>handler=fn};
await import('../supabase/functions/publication-lookup/index.ts');
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
const req=(mode='isbn',value='9780140328721')=>new Request('https://test.example',{method:'POST',headers:{Authorization:'Bearer session'},body:JSON.stringify({mode,value})});
test('lookup rejects non-admin before any upstream request',async()=>{
 let calls=0;globalThis.fetch=async url=>{calls++;return response(url.endsWith('/user')?{}:false);};
 assert.equal((await handler(req())).status,403);assert.equal(calls,2);
});
test('lookup maps ISBN response and writes cache',async()=>{
 let saved=false;
 globalThis.fetch=async(url,opts)=>{
 if(url.endsWith('/user'))return response({id:'user'});
 if(url.includes('/rpc/'))return response(true);
 if(url.includes('publication_lookup_cache')){if(opts.method==='POST')saved=true;return response([]);}
 assert.match(url,/^https:\/\/openlibrary.org\/api\/books/);
 return response({'ISBN:9780140328721':{title:'Matilda',url:'https://openlibrary.org/books/OL1M',identifiers:{isbn_13:['9780140328721']}}});
 };
 const result=await (await handler(req())).json();assert.equal(result.editions[0].title,'Matilda');assert(saved);
});
