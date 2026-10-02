import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={window:{},document:{querySelector:()=>null}};
vm.createContext(ctx);
for(const file of ['isbn.js','duplicates.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const matches=ctx.window.NeoCacheDuplicates.matches;
test('ISBN-10 and ISBN-13 identify the same edition across books and comics',()=>{
 const result=matches({record_kind:'books',publication_isbn:'0-14-032872-6'},[{id:'1',title:'Book',publication_details:{kind:'comics',isbn:'9780140328721'}}]);
 assert.equal(result.length,1);assert.equal(result[0].reasons[0],'Same ISBN');
 assert.equal(matches({record_kind:'books',publication_isbn:'invalid'},[{publication_details:{kind:'books',isbn:'invalid'}}]).length,0);
});
test('UPC and EAN padding match without converting identifiers to numbers',()=>{
 assert.equal(matches({record_kind:'music',music_barcode:'012345678905'},[{music_details:{barcode:'0012345678905'}}]).length,1);
 assert.equal(matches({record_kind:'music',music_barcode:'123'},[{music_details:{barcode:'123'}}]).length,0);
});
test('catalog matches need same artist; release IDs can match without title',()=>{
 const item={music_details:{artist:'Duran Duran',catalog_number:'EMC 3411',musicbrainz_release_id:'release-1'}};
 assert.equal(matches({record_kind:'music',music_artist:' DURAN  DURAN ',music_catalog_number:'emc-3411'},[item]).length,1);
 assert.equal(matches({record_kind:'music',music_artist:'Other',music_catalog_number:'EMC3411'},[item]).length,0);
 assert.equal(matches({record_kind:'music',music_musicbrainz_release_id:'release-1'},[item]).length,1);
});
test('title hints stay in their collection and skip room photos',()=>{
 const items=[{id:'a',title:'Same',type:'Computer'},{id:'b',title:'Same',type:'CD'},{id:'c',title:'Same',item_tags:[{tags:{name:'80s-room'}}]}];
 assert.equal(matches({record_kind:'artifact',title:' same '},items).length,1);
 assert.equal(matches({record_kind:'books',title:'same'},items).length,0);
 assert.equal(matches({record_kind:'artifact',title:''},[{title:''}]).length,0);
});
