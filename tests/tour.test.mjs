import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../tour-core.js';
const T=globalThis.NeoTour;
test('tour positions are percentages, bounded and independent of displayed size',()=>{
 assert.deepEqual(T.point(210,120,{left:10,top:20,width:400,height:200}),{x:50,y:50});
 assert.deepEqual(T.point(410,220,{left:10,top:20,width:800,height:400}),{x:50,y:50});
 assert.deepEqual(T.point(-10,900,{left:0,top:0,width:100,height:100}),{x:0,y:100});
});
test('tour links preserve collection isolation and encode item identifiers',()=>{
 for(const [item,page] of [[{type:'Merch',music_details:{}},'index'],[{type:'LP'},'music'],[{publication_details:{kind:'comics'}},'comics'],[{category:'Books'},'books']])assert.equal(T.itemHref({...item,id:'x&y'}),`${page}.html?item=x%26y`);
 assert(T.isRoom({item_tags:[{tags:{name:'house'}}]}));
 assert(T.isRoom({item_tags:[{tags:{name:'80s-room'}}]}));assert.equal(T.imageUrl('javascript:alert(1)'), '');assert.equal(T.imageUrl('../secret'), '');
});
test('tour pagination keeps later pages',async()=>{
 let calls=0;const result=await T.pages(async()=>++calls===1?[1,2]:calls===2?[3]:[], 'room_tour_scenes?select=*');assert.deepEqual(result,[1,2,3]);
});
