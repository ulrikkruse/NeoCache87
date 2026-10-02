// Verify two historical bugs are detected without modifying application files.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const [mutation,grep] of [['format','Hardback filter'],['navigation','index: collection']]){
 const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--project=chromium-desktop','--grep',grep,'--reporter=json'],{cwd:root,env:{...process.env,NEOCACHE_TEST_MUTATION:mutation},encoding:'utf8'});
 if(result.error)throw result.error;
 let report;try{report=JSON.parse(result.stdout);}catch{throw Error(`Guard ${mutation} did not produce a test report: ${result.stderr}`);}
 const collect=s=>[...(s.specs||[]).flatMap(spec=>spec.tests||[]),...(s.suites||[]).flatMap(collect)];
 const tests=report.suites.flatMap(collect);
 const errors=tests.flatMap(t=>t.results||[]).flatMap(r=>r.errors||[]);
 if(result.status!==1||report.stats?.unexpected!==1||report.stats?.expected!==0||report.errors?.length||!errors.some(e=>e.message?.replace(/\u001b\[[0-9;]*m/g,'').includes(mutation==='format'?'PAPERBACK':'Received: 4'))){
  console.error(result.stdout,result.stderr);throw Error(`Guard ${mutation} did not fail for the expected regression.`);
 }
 console.log(`PASS: browser test detects injected ${mutation} regression.`);
}
