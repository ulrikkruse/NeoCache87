import fs from 'node:fs';
import vm from 'node:vm';
export class Element {
 constructor(){this.value='';this.children=[];this.events={};this.textContent='';this.hidden=false;this.open=false;const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 addEventListener(event,fn){(this.events[event] ||= []).push(fn);}
 fire(event,extra={}){for(const fn of this.events[event]||[])fn({target:this,preventDefault(){},...extra});}
 setAttribute(key,value){this[key]=value;}
 removeAttribute(key){delete this[key];}
 showModal(){this.open=true;}
 close(){this.open=false;this.fire('close');}
 replaceWith(){}
}
export async function archive(page,items,{fetch:customFetch,query=''}={}) {
 const html=fs.readFileSync(`${page}.html`,'utf8');
 const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[`#${match[1]}`,new Element()]));
 const body=new Element();for(const c of (html.match(/<body[^>]*class="([^"]+)"/)?.[1]||'').split(' '))body.classList.add(c);
 const calls=[];
 const context={console:{...console,error(){}},URL,URLSearchParams,Date,document:{body,querySelector:selector=>{if(!ids.has(selector))throw Error(`Missing ${selector} in ${page}.html`);return ids.get(selector);},createElement:()=>new Element(),addEventListener(){}},window:{NEOCACHE_CONFIG:{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLIC_KEY:'fixture'},matchMedia:()=>({matches:true}),location:{href:`https://fixture.invalid/${page}.html${query}`,search:query}},history:{replaceState(){}},localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>fn(),fetch:async url=>{
 calls.push(url);if(customFetch)return customFetch(url);
 const offset=Number(new URL(url).searchParams.get('offset')||0);
 return {ok:true,json:async()=>structuredClone(items.slice(offset,offset+2))};
 }};
 vm.createContext(context);
 // Execute the entire page script, including initialization, DOM binding and fetch.
 // Capture its startup promise rather than relying on arbitrary delays.
 const source=fs.readFileSync('app.js','utf8').replace(/loadItems\(\);\s*$/,'startup = loadItems();');
 vm.runInContext(source,context);await context.startup;
 return {context,ids,calls,read:expression=>vm.runInContext(expression,context)};
}
export const mixedItems=[
 {id:'computer',title:'Amiga',type:'Computer',category:'Hardware',images:[]},
 {id:'merch',title:'Tour shirt',type:'Merch',category:'Music',images:[]},
 {id:'music',title:'Rio',type:'LP',category:'Music',music_details:{artist:'Duran Duran',format:'LP',catalog_number:'EMC 3411'},images:[]},
 {id:'book',title:'Absence',type:'Hardback',category:'Books',publication_details:{kind:'books',format:'Paperback',author:'Writer',isbn:'9780140328721'},images:[]},
 {id:'comic',title:'Watchmen',type:'Comic album',category:'Comics',publication_details:{kind:'comics',format:'Comic album',series:'Watchmen',issue:'001'},images:[]},
 {id:'room',title:'Room photo',type:'Computer',category:'Hardware',tags:['80s-room'],images:[]}
];
