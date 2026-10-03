import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deploy,readWebsite,websiteFiles} from '../scripts/deploy-neocities.mjs';

const key='synthetic-deploy-key-not-real';
const files=await readWebsite();
function mock({wrongSite=false,failUpload=false,staleAfter=false}={}){
 const calls=[];let uploaded=false;
 const request=async(url,options)=>{
  const endpoint=url.split('/').at(-1);calls.push({endpoint,options});
  assert.equal(options.headers.Authorization,`Bearer ${key}`);
  if(endpoint==='info')return Response.json({result:'success',info:{sitename:wrongSite?'another-site':'neocache87'}});
  if(endpoint==='upload'){
   if(failUpload)return Response.json({result:'error',message:key},{status:403});
   uploaded=true;return Response.json({result:'success'});
  }
  assert.equal(endpoint,'list');
  return Response.json({result:'success',files:files.map(f=>({path:f.name,is_directory:false,sha1_hash:f.name==='index.html'&&(!uploaded||staleAfter)?'old-hash':f.hash}))});
 };
 return {calls,request};
}
test('deployment manifest contains only explicitly approved website assets',()=>{
 assert.equal(files.length,27);
 for(const file of files)assert(!/(\.env|\.sql|^tests\/|^scripts\/|package|AGENTS|README)/.test(file.name));
 assert(websiteFiles.includes('vendor/ZXING-LICENSE'));
});
test('dry run compares remote hashes without uploading',async()=>{
 const m=mock();const result=await deploy({key,files,dryRun:true,request:m.request,log(){}});
 assert.deepEqual(result.changed,['index.html']);assert.deepEqual(m.calls.map(c=>c.endpoint),['info','list']);
});
test('upload sends only changed files then verifies hashes; identical deploy does nothing',async()=>{
 const m=mock();const result=await deploy({key,files,request:m.request,log(){}});
 assert.deepEqual(result.uploaded,['index.html']);
 const body=m.calls.find(c=>c.endpoint==='upload').options.body;
 assert.deepEqual([...body.keys()],['index.html']);
 assert.equal(await body.get('index.html').text(),files.find(f=>f.name==='index.html').data.toString());
 await deploy({key,files,request:m.request,log(){}});
 assert.equal(m.calls.filter(c=>c.endpoint==='upload').length,1);
});
test('wrong-site key blocks all uploads',async()=>{
 const m=mock({wrongSite:true});await assert.rejects(deploy({key,files,request:m.request}),/does not belong/);
 assert.deepEqual(m.calls.map(c=>c.endpoint),['info']);
});
test('upload error never leaks returned credentials and is not retried',async()=>{
 const m=mock({failUpload:true});await assert.rejects(deploy({key,files,request:m.request,log(){}}),error=>!error.message.includes(key)&&error.message.includes('HTTP 403'));
 assert.equal(m.calls.filter(c=>c.endpoint==='upload').length,1);
});
test('remote verification catches incomplete uploads',async()=>{
 const m=mock({staleAfter:true});await assert.rejects(deploy({key,files,request:m.request,log(){}}),/hashes do not all match/);
});
test('private files and a leaked key are rejected before contacting Neocities',async()=>{
 const request=()=>{throw Error('Must not contact server');};
 await assert.rejects(deploy({key,files:[...files,{name:'.env.neocities',data:Buffer.from(key)}],request}),/manifest/);
 await assert.rejects(deploy({key,files:files.map((f,i)=>i?f:{...f,data:Buffer.from(key)}),request}),/contains the API key/);
});
