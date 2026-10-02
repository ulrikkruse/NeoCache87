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
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('publication-lookup.js','utf8'),ctx);
 return {ctx,get};
}
test('lookup requires explicit release choice and preserves photos/condition',async()=>{
 const {ctx,get}=setup();get('#pub-lookup-query').value='9780140328721';get('#pub-lookup-mode').value='isbn';
 ctx.itemForm.elements.title.value='Original';ctx.itemForm.elements.music_media_condition.value='VG+';
 ctx.fetch=async()=>({ok:true,json:async()=>({total:1,editions:[{title:'Fantastic Mr. Fox',author:'Roald Dahl',format:'Paperback',isbn:'9780140328721',openlibrary_id:'OL123M'}]})});
 await get('#pub-lookup-search').events.click();
 assert.equal(ctx.itemForm.elements.title.value,'Original');
 const card=get('#pub-lookup-results').children[0];await card.children.at(-1).events.click();
 assert.equal(ctx.itemForm.elements.title.value,'Fantastic Mr. Fox');assert.equal(ctx.itemForm.elements.publication_isbn.value,'9780140328721');assert.equal(ctx.itemForm.elements.publication_openlibrary_id.value,'OL123M');assert.equal(ctx.itemForm.elements.music_media_condition.value,'VG+');
});
test('no matches leaves existing fields intact and offers manual search',async()=>{
 const {ctx,get}=setup();get('#pub-lookup-query').value='12345678';ctx.itemForm.elements.title.value='Original';
 ctx.fetch=async()=>({ok:true,json:async()=>({total:0,editions:[]})});await get('#pub-lookup-search').events.click();
 assert.equal(ctx.itemForm.elements.title.value,'Original');assert.match(get('#pub-lookup-status').textContent,/No matches/);
});
test('camera stops stream when cancelled',()=>{
 const {get}=setup();let stopped=false;get('#pub-barcode-video').srcObject={getTracks:()=>[{stop(){stopped=true;}}]};
 get('#pub-barcode-stop').events.click();assert(stopped);assert.equal(get('#pub-barcode-video').srcObject,null);assert(get('#pub-barcode-camera').hidden);
});
