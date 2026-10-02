import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archive,mixedItems} from './helpers/archive.mjs';
for(const [page,expected] of [['index',['computer','merch']],['music',['music']],['books',['book']],['comics',['comic']]]) {
 test(`${page}: startup, pagination and collection isolation`,async()=>{
 const app=await archive(page,mixedItems);
 assert.deepEqual(Array.from(app.read('allItems'),item=>item.id),expected);
 assert.equal(app.ids.get('#item-grid').children.length,expected.length);
 assert(app.calls.some(url=>url.includes('offset=6')));
 });
}
test('Hardback edit overrides stale Paperback detail in options, filtering and card',async()=>{
 const app=await archive('books',mixedItems);
 assert.deepEqual(app.ids.get('#type-filter').children.map(n=>n.value),['Hardback']);
 app.ids.get('#type-filter').value='Hardback';app.ids.get('#filters').fire('change');
 assert.equal(app.ids.get('#item-grid').children.length,1);
 const flatten=node=>[node.textContent,...node.children.flatMap(flatten)].join(' ');
 assert.match(flatten(app.ids.get('#item-grid')),/Hardback/);
 assert.doesNotMatch(flatten(app.ids.get('#item-grid')),/Paperback/);
});
test('artist, format and catalog search combine; empty match does not show stale cards',async()=>{
 const app=await archive('music',mixedItems);
 app.ids.get('#category-filter').value='Duran Duran';app.ids.get('#type-filter').value='LP';app.ids.get('#search-filter').value='emc 3411';app.ids.get('#filters').fire('change');
 assert.equal(app.ids.get('#item-grid').children.length,1);
 app.ids.get('#search-filter').value='missing';app.ids.get('#search-filter').fire('input');
 assert.equal(app.ids.get('#item-grid').children.length,0);assert.equal(app.ids.get('#status').hidden,false);
});
test('ISBN and comic issue remain searchable',async()=>{
 for(const [page,query] of [['books','9780140328721'],['comics','001']]){
 const app=await archive(page,mixedItems);app.ids.get('#search-filter').value=query;app.ids.get('#search-filter').fire('input');assert.equal(app.ids.get('#item-grid').children.length,1);
 }
});
test('primary image sorting and gallery navigation wrap correctly',async()=>{
 const app=await archive('books',[]);
 app.context.fixture={title:'Book',images:[{storage_path:'books/back.jpg'},{storage_path:'books/front.jpg',is_primary:true}]};
 app.read('openImageViewer(getItemImages(fixture), fixture.title)');
 assert(app.ids.get('#image-lightbox').open);assert.match(app.ids.get('#lightbox-image').src,/front.jpg$/);
 app.ids.get('#next-image').fire('click');assert.match(app.ids.get('#lightbox-image').src,/back.jpg$/);
 app.ids.get('#next-image').fire('click');assert.match(app.ids.get('#lightbox-image').src,/front.jpg$/);
 app.ids.get('#close-lightbox').fire('click');assert.equal(app.ids.get('#image-lightbox').open,false);
});
test('existing Archive survives missing optional tables',async()=>{
 const app=await archive('index',mixedItems,{fetch:async url=>{
 const q=new URL(url).searchParams;const missing=['publication_details','music_details'].find(name=>q.get('select').includes(name));
 if(missing){const body={code:'PGRST200',message:`Missing relationship ${missing}`};return {ok:false,clone:()=>({json:async()=>body}),json:async()=>body};}
 return {ok:true,json:async()=>q.has('offset')?[]:structuredClone(mixedItems)};
 }});
 assert.equal(app.ids.get('#item-grid').children.length,2);
});
test('Books reports missing publication schema instead of silently appearing empty',async()=>{
 const body={code:'PGRST200',message:'Missing relationship publication_details'};
 const app=await archive('books',[],{fetch:async()=>({ok:false,clone:()=>({json:async()=>body}),json:async()=>body})});
 assert.equal(app.ids.get('#item-count').textContent,'Connection error');assert.equal(app.calls.length,1);
});
