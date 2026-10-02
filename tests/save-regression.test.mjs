import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
async function save({kind='artifact',fail='',refreshFails=false}={}){
 const calls=[],statuses=[];
 const values=new Map(Object.entries({record_kind:kind,title:'Fixture',folder:'test',music_artist:'Artist',music_format:'LP',music_barcode:'001234567890'}));
 const context={itemForm:{addEventListener:(_,fn)=>context.submit=fn,reset(){}},filesInput:{files:[{type:'image/jpeg',name:'front.jpg'},{type:'image/jpeg',name:'back.jpg'}]},saveButton:{},saveStatus:{},session:{user:{id:'owner'}},FormData:function(){return values;},slugify:s=>s,uniqueValues:a=>a.filter(Boolean),setStatus:(_,s)=>statuses.push(s),uploadImage:async(_,name)=>{calls.push('upload');if(fail==='upload'&&calls.filter(c=>c==='upload').length===2)throw Error('Upload failed');},deleteUploadedImage:async()=>calls.push('delete image'),discardIncompleteItem:async id=>{if(id)calls.push('delete item');},createTags:async()=>{},clearPreviews(){},syncRecordKind(){},refreshStorageFolders(){},loadEditorData:async()=>{if(refreshFails)throw Error('Refresh failed');},restRequest:async(p,options)=>{calls.push(p);if(p===fail)throw Error('Write failed');if(p==='items')return [{id:'fixture'}];if(p==='music_details')assert.equal(JSON.parse(options.body).barcode,'001234567890');return [];}};
 vm.createContext(context);const source=fs.readFileSync('admin.js','utf8');vm.runInContext(source.slice(source.indexOf('itemForm.addEventListener("submit"'),source.indexOf('\nif (!projectUrl')),context);await context.submit({preventDefault(){}});return {calls,statuses,context};
}
for(const kind of ['artifact','music'])test(`${kind}: save completes without rollback`,async()=>{const r=await save({kind});assert(r.statuses.some(s=>s.includes('COMMIT COMPLETE')));assert(!r.calls.includes('delete item'));assert.equal(r.context.saveButton.disabled,false);});
test('partial upload failure deletes only successful uploads',async()=>{const r=await save({fail:'upload'});assert.equal(r.calls.filter(c=>c==='delete image').length,1);assert(!r.calls.includes('items'));});
test('detail write failure rolls back the item and images',async()=>{const r=await save({kind:'music',fail:'music_details'});assert(r.calls.includes('delete item'));assert.equal(r.calls.filter(c=>c==='delete image').length,2);assert(r.statuses.at(-1).includes('INTERRUPTED'));});
test('refresh failure after successful save never deletes the saved record',async()=>{const r=await save({refreshFails:true});assert(!r.calls.includes('delete item'));assert(!r.calls.includes('delete image'));assert(r.statuses.at(-1).includes('COMMIT COMPLETE'));});
