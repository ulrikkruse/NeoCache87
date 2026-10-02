import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function storage(fetch){
 const c={session:{access_token:'fixture'},editorPanel:{hidden:false},document:{hidden:false},folderRefresh:null,projectUrl:'https://fixture.invalid',publicKey:'fixture',folderOptions:{values:[],replaceChildren(){this.values=[];}},folderStatus:{},renderDatalist:(e,v)=>e.values=[...new Set(v)].sort(),parseResponse:async r=>{if(!r.ok)throw Error('Denied');return r.json();},fetch};
 vm.createContext(c);const s=fs.readFileSync('admin.js','utf8');vm.runInContext(s.slice(s.indexOf('function refreshStorageFolders()'),s.indexOf('folderInput.addEventListener("focus"')),c);return c;
}
test('Storage fetches later pages, filters files and preserves folder capitalization',async()=>{
 const offsets=[];const c=storage(async(_,options)=>{const offset=JSON.parse(options.body).offset;offsets.push(offset);return {ok:true,json:async()=>offset===0?Array.from({length:100},()=>({id:'file',metadata:{},name:'ignore.jpg'})):[{id:null,metadata:null,name:'Software'},{id:null,metadata:null,name:'80s-room'}]};});
 await c.refreshStorageFolders();assert.deepEqual(offsets,[0,100]);assert.deepEqual(c.folderOptions.values,['80s-room','Software']);
 c.fetch=async()=>({ok:true,json:async()=>[]});await c.refreshStorageFolders();assert.equal(c.folderOptions.values.length,0);
});
test('Storage errors clear stale suggestions and report failure',async()=>{
 const c=storage(async()=>({ok:false}));c.folderOptions.values=['obsolete'];await c.refreshStorageFolders();assert.equal(c.folderOptions.values.length,0);assert.match(c.folderStatus.textContent,/Denied/);
});
test('Storage does not repopulate suggestions after logout during request',async()=>{
 let resolve;const c=storage(()=>new Promise(r=>resolve=r));const pending=c.refreshStorageFolders();c.session=null;resolve({ok:true,json:async()=>[{id:null,metadata:null,name:'private'}]});await pending;assert.equal(c.folderOptions.values.length,0);
});
