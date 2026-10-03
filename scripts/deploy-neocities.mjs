import {readFile, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const site = 'neocache87';
export const websiteFiles = Object.freeze([
 'index.html','music.html','books.html','comics.html','rooms.html','about.html','admin.html',
 'style.css','rooms.css','about.css','admin.css',
 'config.js','app.js','rooms.js','admin.js','isbn.js','music-lookup.js',
 'publication-lookup.js','visitor-counter.js','duplicates.js',
 'vendor/zxing-browser-0.1.5.min.js','vendor/ZXING-LICENSE',
 'tour.html','tour.css','tour-core.js','tour.js','admin-tour.js'
]);
const root = fileURLToPath(new URL('../',import.meta.url));
const sha1 = data => createHash('sha1').update(data).digest('hex');

export async function readWebsite(directory=root) {
 const files=[];
 for(const name of websiteFiles){
  // Do not follow symlinks outside the website, including parent directories.
  let current=directory;
  for(const part of name.split('/')){
   current=path.join(current,part);
   if((await lstat(current)).isSymbolicLink())throw Error(`Refusing symlink: ${name}`);
  }
  const data=await readFile(current);
  files.push({name,data,hash:sha1(data)});
 }
 return files;
}

export async function deploy({key,files,dryRun=false,request=fetch,log=console.log}) {
 if(!key?.trim())throw Error('Set NEOCITIES_API_KEY in .env.neocities before connecting.');
 // An explicit manifest is the only source of upload paths.
 if(files.length!==websiteFiles.length || new Set(files.map(f=>f.name)).size!==files.length || files.some(f=>!websiteFiles.includes(f.name)))throw Error('Invalid website manifest.');
 if(files.some(f=>f.data.includes(Buffer.from(key))))throw Error('A website file contains the API key; upload refused.');
 async function api(endpoint,options={}){
  let response;
  try {
   response=await request(`https://neocities.org/api/${endpoint}`,{
    ...options,headers:{Authorization:`Bearer ${key}`},redirect:'error',signal:AbortSignal.timeout(60000)
   });
  } catch { throw Error(`Neocities ${endpoint}: connection failed. No automatic retry; run a new plan to check remote files.`); }
  let result;
  try { result=await response.json(); } catch { throw Error(`Neocities ${endpoint}: invalid response (HTTP ${response.status}).`); }
  if(!response.ok || result.result!=='success')throw Error(`Neocities ${endpoint} failed (HTTP ${response.status}). Check API access and site limits.`);
  return result;
 }
 const info=await api('info');
 if(info.info?.sitename!==site)throw Error(`API key does not belong to ${site}; upload refused.`);
 async function changedFiles(){
  const result=await api('list');
  if(!Array.isArray(result.files))throw Error('Invalid Neocities file list.');
  return files.filter(file=>!result.files.some(remote=>remote.path===file.name && !remote.is_directory && remote.sha1_hash===file.hash));
 }
 const changed=await changedFiles();
 log(`${site}: ${changed.length} of ${files.length} website files need uploading.`);
 for(const file of changed)log(`  ${file.name}`);
 if(dryRun || !changed.length)return {uploaded:[],changed:changed.map(f=>f.name)};
 const body=new FormData();
 for(const file of changed)body.append(file.name,new Blob([file.data]),path.basename(file.name));
 await api('upload',{method:'POST',body});
 const remaining=await changedFiles();
 if(remaining.length)throw Error('Upload returned success, but remote hashes do not all match. Run a new plan before retrying.');
 log(`Verified ${changed.length} uploaded files against Neocities hashes.`);
 return {uploaded:changed.map(f=>f.name),changed:[]};
}

function git(...args){
 const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});
 if(result.status!==0)throw Error('Could not verify Git state. Commit and push before deploying.');
 return result.stdout.trim();
}

async function main(){
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--dry-run'))throw Error('Usage: node scripts/deploy-neocities.mjs [--dry-run]');
 const dryRun=args.includes('--dry-run');
 let local={};
 try {local=parseEnv(await readFile(path.join(root,'.env.neocities'),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw Error('Could not read .env.neocities.');}
 const key=(process.env.NEOCITIES_API_KEY || local.NEOCITIES_API_KEY || '').trim();
 if(!key)throw Error('Save the API key in .env.neocities as NEOCITIES_API_KEY=your-key. Do not paste it into chat.');
 if(!dryRun){
  if(git('status','--porcelain'))throw Error('Commit all project changes before deploying.');
  if(git('rev-parse','HEAD')!==git('rev-parse','@{upstream}'))throw Error('Push the current commit before deploying.');
  const tests=spawnSync('npm',['run','test:all'],{cwd:root,stdio:'inherit'});
  if(tests.status!==0)throw Error('Regression checks failed; nothing uploaded.');
  if(git('status','--porcelain'))throw Error('Project changed during tests; nothing uploaded.');
 }
 await deploy({key,files:await readWebsite(),dryRun});
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
