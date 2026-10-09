import {test as base,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {mixedItems} from '../helpers/archive.mjs';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=','base64');
const user={id:'test-owner',email:'tester@example.invalid'};
export const test=base.extend({
 backend:async({context},use)=>{
  const items=structuredClone(mixedItems).map(item=>({...item,slug:item.id,images:[{storage_path:`${item.id}/front.png`,is_primary:true},{storage_path:`${item.id}/back.png`}],item_tags:item.id==='room'?[{tags:{name:'80s-room'}}]:[]}));
  const state={pressArticles:[],pressPages:[],pressFailure:false,pressWriteFailure:false,pressImageFailure:false,memories:[],memoryPhotos:[],memoryFailure:false,memoryWriteFailure:false,memoryImageFailure:false,scenes:[],tourPoints:[],tourFailure:false,tourWriteFailure:false,visitTotal:1234,visitIds:new Set(),visitCalls:[],counterFailure:false,items,writes:[],unexpected:[],errors:[],folders:['books','comics','Software'],failSave:false,lookupEmpty:false,lookupFailure:false,publicationLookups:[],musicLookups:[]};
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
   const memoryAdmin=request.headers().authorization==='Bearer fixture-session';
   if(p.startsWith('/storage/v1/object/press/')&&method==='GET'){
    const path=p.split('/press/')[1], photo=state.pressPages.find(row=>row.path===path);
    const allowed=memoryAdmin || photo&&state.pressArticles.some(row=>row.id===photo.article_id&&row.published);
    if(!allowed||state.pressImageFailure)return json({message:'Photo unavailable'},403);
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#e8dfc6"/><text x="55" y="100" fill="#302d2a" font-size="46">SYNTHETIC DAILY</text><path d="M55 130H845" stroke="#302d2a" stroke-width="5"/><text x="55" y="200" fill="#302d2a" font-size="32">Duran Duran in print</text><rect x="55" y="250" width="790" height="310" fill="#676578"/><path d="M55 620H420M480 620H845M55 670H420M480 670H845M55 720H420M480 720H845M55 770H420M480 770H845M55 820H420M480 820H845M55 870H420M480 870H845M55 920H420M480 920H845M55 970H420M480 970H845M55 1020H420M480 1020H845" stroke="#777168" stroke-width="12"/><text x="55" y="1130" fill="#302d2a" font-size="22">TEST FIXTURE — NOT A REAL ARTICLE</text></svg>'});
   }
   if(p.startsWith('/storage/v1/object/press/')&&method==='POST'){
    state.writes.push({path:p,method});
    return memoryAdmin?json({}):json({message:'Forbidden'},403);
   }
   if(['/rest/v1/press_articles','/rest/v1/press_pages'].includes(p)){
    if(state.pressFailure)return json({message:'Memories unavailable'},503);
    const press_articles=p.endsWith('/press_articles'), records=press_articles?state.pressArticles:state.pressPages;
    if(method==='GET'){
     let rows=records.filter(row=>memoryAdmin||(press_articles?row.published:state.pressArticles.some(m=>m.id===row.article_id&&m.published)));
     for(const key of ['id','article_id','related_item_id'])if(url.searchParams.has(key))rows=rows.filter(r=>'eq.'+r[key]===url.searchParams.get(key));
     if(url.searchParams.get('published')==='eq.true')rows=rows.filter(r=>r.published);
     if(!press_articles)rows.sort((a,b)=>a.position-b.position);
     if(press_articles)rows=rows.sort((a,b)=>(b.year||0)-(a.year||0)).map(row=>({...row,press_pages:state.pressPages.filter(p=>p.article_id===row.id).sort((a,b)=>a.position-b.position).slice(0,1)}));
     const offset=Number(url.searchParams.get('offset')||0);return json(rows.slice(offset,offset+2));
    }
    const body=method==='DELETE'?null:request.postDataJSON();state.writes.push({path:p,method,body});
    if(!memoryAdmin)return json({message:'Forbidden'},403);
    if(state.pressWriteFailure)return json({message:'Fixture press write failure'},500);
    if(method==='POST'){const row={...body,id:body.id||'photo-'+(records.length+1)};records.push(row);return json([row]);}
    const index=records.findIndex(r=>'eq.'+r.id===url.searchParams.get('id'));
    if(method==='PATCH'){if(index<0)return json([]);Object.assign(records[index],body);return json([records[index]]);}
    if(method==='DELETE'){if(index>=0)records.splice(index,1);return json([]);}
   }
   if(p.startsWith('/storage/v1/object/memories/')&&method==='GET'){
    const path=p.split('/memories/')[1], photo=state.memoryPhotos.find(row=>row.path===path);
    const allowed=memoryAdmin || photo&&state.memories.some(row=>row.id===photo.memory_id&&row.published);
    if(!allowed||state.memoryImageFailure)return json({message:'Photo unavailable'},403);
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#29283e"/><path d="M0 430H900V600H0Z" fill="#625568"/><path d="M80 430V230L220 140L360 230V430M480 430V190H750V430" fill="#8f7480" stroke="#dbb887" stroke-width="8"/><text x="45" y="70" fill="#fff0cd" font-size="28">SYNTHETIC CHILDHOOD PHOTO</text></svg>'});
   }
   if(p.startsWith('/storage/v1/object/memories/')&&method==='POST'){
    state.writes.push({path:p,method});
    return memoryAdmin?json({}):json({message:'Forbidden'},403);
   }
   if(['/rest/v1/memories','/rest/v1/memory_photos'].includes(p)){
    if(state.memoryFailure)return json({message:'Memories unavailable'},503);
    const memories=p.endsWith('/memories'), records=memories?state.memories:state.memoryPhotos;
    if(method==='GET'){
     let rows=records.filter(row=>memoryAdmin||(memories?row.published:state.memories.some(m=>m.id===row.memory_id&&m.published)));
     for(const key of ['id','memory_id','related_item_id'])if(url.searchParams.has(key))rows=rows.filter(r=>'eq.'+r[key]===url.searchParams.get(key));
     if(url.searchParams.get('published')==='eq.true')rows=rows.filter(r=>r.published);
     if(!memories)rows.sort((a,b)=>a.position-b.position);
     const offset=Number(url.searchParams.get('offset')||0);return json(rows.slice(offset,offset+2));
    }
    const body=method==='DELETE'?null:request.postDataJSON();state.writes.push({path:p,method,body});
    if(!memoryAdmin)return json({message:'Forbidden'},403);
    if(state.memoryWriteFailure)return json({message:'Fixture memory write failure'},500);
    if(method==='POST'){const row={...body,id:body.id||'photo-'+(records.length+1)};records.push(row);return json([row]);}
    const index=records.findIndex(r=>'eq.'+r.id===url.searchParams.get('id'));
    if(method==='PATCH'){if(index<0)return json([]);Object.assign(records[index],body);return json([records[index]]);}
    if(method==='DELETE'){if(index>=0)records.splice(index,1);return json([]);}
   }
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
   if(['/rest/v1/room_tour_scenes','/rest/v1/room_tour_points'].includes(p)){
    if(state.tourFailure)return json({message:'Tour unavailable'},503);
    const scenes=p.endsWith('scenes'), records=scenes?state.scenes:state.tourPoints;
    if(method==='GET'){
     let rows=records.filter(r=>!url.searchParams.has('scene_id')||'eq.'+r.scene_id===url.searchParams.get('scene_id'));
     if(url.searchParams.get('published')==='eq.true')rows=rows.filter(r=>r.published);
     if(!scenes && url.searchParams.get('select')?.includes('items('))rows=rows.filter(r=>state.scenes.some(s=>s.id===r.scene_id&&s.published)).map(r=>({...r,items:items.find(i=>i.id===r.item_id)||null}));
     const offset=Number(url.searchParams.get('offset')||0);return json(rows.slice(offset,offset+2));
    }
    const body=method==='DELETE'?null:request.postDataJSON();state.writes.push({path:p,method,body});
    if(state.tourWriteFailure)return json({message:'Fixture tour write failure'},500);
    if(method==='POST'){const row={...body,id:body.id||'point-'+(records.length+1)};records.push(row);return json([row]);}
    const index=records.findIndex(r=>'eq.'+r.id===url.searchParams.get('id'));
    if(method==='PATCH'){if(index<0)return json([]);Object.assign(records[index],body);return json([records[index]]);}
    if(method==='DELETE'){if(index>=0)records.splice(index,1);return json([]);}
   }
   if(p.startsWith('/rest/v1/')){
    const table=p.slice('/rest/v1/'.length);
    if(!['items','images','tags','item_tags','music_details','publication_details'].includes(table)){state.unexpected.push(p);return route.abort();}
    if(method==='GET'){
     if(table==='items'){const offset=Number(url.searchParams.get('offset')||0);const rows=items.filter(item=>!url.searchParams.has('id')||'eq.'+item.id===url.searchParams.get('id'));return json(rows.slice(offset,offset+2));}
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
