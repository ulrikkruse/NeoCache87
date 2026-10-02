import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function setup() {
 const nodes=new Map();
 const node=()=>({value:'',children:[],events:{},addEventListener(e,f){this.events[e]=f;},append(...v){this.children.push(...v);},replaceChildren(...v){this.children=v;},focus(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const itemForm=node();itemForm.elements=new Proxy({},{get:(o,k)=>o[k] ||= node()});
 const ctx={document:{querySelector:get,createElement:node,addEventListener(){}},window:{addEventListener(){}},recordKind:node(),logoutButton:node(),itemForm,session:{access_token:'test'},projectUrl:'https://test.example',publicKey:'anon',AbortController,setTimeout,clearTimeout};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('music-lookup.js','utf8'),ctx);
 return {ctx,get};
}
test('lookup requires explicit release choice and preserves photos/condition',async()=>{
 const {ctx,get}=setup();get('#lookup-query').value='EMC 3411';get('#lookup-mode').value='catalog';
 ctx.itemForm.elements.title.value='Original';ctx.itemForm.elements.music_media_condition.value='VG+';
 ctx.fetch=async()=>({ok:true,json:async()=>({total:1,releases:[{title:'Rio',artist:'Duran Duran',format:'LP',catalog_number:'EMC 3411',musicbrainz_release_id:'d133c53f-2144-4152-a490-1a2c8c560f1c'}]})});
 await get('#lookup-search').events.click();
 assert.equal(ctx.itemForm.elements.title.value,'Original');
 const card=get('#lookup-results').children[0];card.children.at(-1).events.click();
 assert.equal(ctx.itemForm.elements.title.value,'Rio');assert.equal(ctx.itemForm.elements.music_catalog_number.value,'EMC 3411');assert.equal(ctx.itemForm.elements.music_musicbrainz_release_id.value,'d133c53f-2144-4152-a490-1a2c8c560f1c');assert.equal(ctx.itemForm.elements.music_media_condition.value,'VG+');
});
test('no matches leaves existing fields intact and offers manual search',async()=>{
 const {ctx,get}=setup();get('#lookup-query').value='12345678';ctx.itemForm.elements.title.value='Original';
 ctx.fetch=async()=>({ok:true,json:async()=>({total:0,releases:[]})});await get('#lookup-search').events.click();
 assert.equal(ctx.itemForm.elements.title.value,'Original');assert.match(get('#lookup-status').textContent,/No matches/);
});
test('camera stops stream when cancelled',()=>{
 const {get}=setup();let stopped=false;get('#barcode-video').srcObject={getTracks:()=>[{stop(){stopped=true;}}]};
 get('#barcode-stop').events.click();assert(stopped);assert.equal(get('#barcode-video').srcObject,null);assert(get('#barcode-camera').hidden);
});
