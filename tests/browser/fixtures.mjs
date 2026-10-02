import {test as base,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {mixedItems} from '../helpers/archive.mjs';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=','base64');
const user={id:'test-owner',email:'tester@example.invalid'};
export const test=base.extend({
 backend:async({context},use)=>{
  const items=structuredClone(mixedItems).map(item=>({...item,slug:item.id,images:[{storage_path:`${item.id}/front.png`,is_primary:true},{storage_path:`${item.id}/back.png`}],item_tags:item.id==='room'?[{tags:{name:'80s-room'}}]:[]}));
  const state={visitTotal:1234,visitIds:new Set(),visitCalls:[],counterFailure:false,items,writes:[],unexpected:[],errors:[],folders:['books','comics','Software'],failSave:false,lookupEmpty:false,lookupFailure:false,publicationLookups:[],musicLookups:[]};
  context.on('page',page=>page.on('pageerror',error=>state.errors.push(error.message)));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.origin==='http://127.0.0.1:4187'){
    if(process.env.NEOCACHE_TEST_MUTATION==='format'&&url.pathname==='/app.js'){
     const source=await fs.readFile('app.js','utf8');
     return route.fulfill({contentType:'text/javascript',body:source.replace('if (item.publication_details) return type?.trim() || item.publication_details.format || item.item_type || "Unknown";', 'if (item.publication_details) return item.publication_details.format;')});
    }
    if(process.env.NEOCACHE_TEST_MUTATION==='navigation'&&url.pathname==='/index.html'){
     const source=await fs.readFile('index.html','utf8');
     return route.fulfill({contentType:'text/html',body:source.replace(/<a class="rooms-link" href="comics.html"[^>]*>COMICS<\/a>/,'')});
    }
    if(url.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.NEOCACHE_CONFIG={SUPABASE_URL:"https://fixture.invalid",SUPABASE_PUBLIC_KEY:"fixture"};'});
    return route.continue();
   }
   if(url.hostname!=='fixture.invalid'){state.unexpected.push(request.url());return route.abort();}
   const method=request.method(),p=url.pathname;
   if(p.startsWith('/storage/v1/object/public/images/'))return route.fulfill({contentType:'image/png',body:png});
   if(p==='/auth/v1/token'&&method==='POST')return json({access_token:'fixture-session',user});
   if(p==='/auth/v1/user')return json(user);
   if(p==='/auth/v1/logout')return json({});
   if(p==='/storage/v1/object/list/images')return json(state.folders.map(name=>({name,id:null,metadata:null})));
   if(p.startsWith('/storage/v1/object/images/')&&['POST','DELETE'].includes(method)){state.writes.push({path:p,method});return json({});}
   if(p==='/functions/v1/publication-lookup'){
    const body=request.postDataJSON();state.publicationLookups.push(body);
    if(state.lookupFailure)return json({error:'Fixture service unavailable'},502);
    return json({total:state.lookupEmpty?0:1,editions:state.lookupEmpty?[]:[{title:'Scanned Book',author:'Fixture Author',isbn:'9780140328721',openlibrary_id:'OL123M',year:'1988',publisher:'Fixture Press',format:'Paperback',needs_details:body.mode==='title'}]});
   }
   if(p==='/functions/v1/music-lookup'){
    state.musicLookups.push(request.postDataJSON());return json({total:1,releases:[{title:'Scanned Album',artist:'Fixture Artist',format:'LP',catalog_number:'CAT 001',musicbrainz_release_id:'d133c53f-2144-4152-a490-1a2c8c560f1c'}]});
   }
   if(p==='/rest/v1/rpc/register_visit'){
    const body=request.postDataJSON();state.visitCalls.push(body);
    if(state.counterFailure)return json({message:'Counter unavailable'},503);
    if(body.p_visit_id&&!state.visitIds.has(body.p_visit_id)){state.visitIds.add(body.p_visit_id);state.visitTotal++;}
    return json(state.visitTotal);
   }
   if(p.startsWith('/rest/v1/')){
    const table=p.slice('/rest/v1/'.length);
    if(!['items','images','tags','item_tags','music_details','publication_details'].includes(table)){state.unexpected.push(p);return route.abort();}
    if(method==='GET'){
     if(table==='items'){const offset=Number(url.searchParams.get('offset')||0);return json(items.slice(offset,offset+2));}
     return json([]);
    }
    if(method==='PATCH'&&table==='items'){
     const body=request.postDataJSON();state.writes.push({path:p,method,body});
     if(state.failSave)return json({message:'Fixture update failure'},500);
     const item=items.find(item=>'eq.'+item.id===url.searchParams.get('id'));
     if(item)Object.assign(item,body);
     return json(item?[item]:[]);
    }
    if(['POST','DELETE'].includes(method)){
     const body=method==='POST'?request.postDataJSON():null;
     state.writes.push({path:p,method,body});
     if(state.failSave&&table==='publication_details'&&method==='POST')return json({message:'Fixture detail failure'},500);
     return json(table==='items'&&method==='POST'?[{...body,id:'created-fixture'}]:[]);
    }
   }
   state.unexpected.push(`${method} ${request.url()}`);return route.abort();
  });
  await use(state);
  expect(state.unexpected,'No unmocked external requests or production traffic').toEqual([]);
  expect(state.errors,'No uncaught browser JavaScript errors').toEqual([]);
 }
});
export {expect};
export async function login(page){
 await page.goto('/admin.html');
 await page.locator('#login-email').fill('tester@example.invalid');await page.locator('#login-password').fill('fixture-only');
 await page.getByRole('button',{name:'AUTHENTICATE'}).click();await expect(page.locator('#editor-panel')).toBeVisible();
}
