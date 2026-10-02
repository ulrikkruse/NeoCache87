import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
function walk(dir) {
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.name.startsWith('.')||entry.name==='node_modules'?[]:entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
}
const files=walk('.');
function run(args) {
 const result=spawnSync(process.execPath,args,{stdio:'inherit',cwd:root});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
console.log('Checking JavaScript and TypeScript syntax…');
for(const file of files.filter(file=>/\.(js|mjs|ts)$/.test(file)))run(['--experimental-strip-types','--check',file]);
console.log('Running offline regression tests…');
run(['--experimental-strip-types','--test',...files.filter(file=>file.endsWith('.test.mjs'))]);
console.log('\nNeoCache regression checks passed.');
