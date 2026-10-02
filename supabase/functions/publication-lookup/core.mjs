export function normalize(value) { return String(value || '').replace(/[\s-]/g, '').toUpperCase(); }
export function valid(value) {
 const isbn = normalize(value);
 if (/^\d{9}[\dX]$/.test(isbn)) return [...isbn].reduce((sum,c,i)=>sum+(c==='X'?10:Number(c))*(10-i),0)%11===0;
 if (/^97[89]\d{10}$/.test(isbn)) return [...isbn].reduce((sum,c,i)=>sum+Number(c)*(i%2?3:1),0)%10===0;
 return false;
}
export function lookupPath(mode, value) {
 value = String(value || '').trim();
 if (!value || value.length > 160) throw Error('Enter a search value of up to 160 characters.');
 if (mode === 'isbn' || mode === 'edition') {
  if (mode === 'isbn' && !valid(value)) throw Error('Invalid ISBN. Check the digits; music barcodes and comic UPCs are not ISBNs.');
  if (mode === 'edition' && !/^OL\d+M$/.test(value)) throw Error('Invalid edition.');
  return '/api/books?' + new URLSearchParams({bibkeys:mode==='isbn'?`ISBN:${normalize(value)}`:`OLID:${value}`,jscmd:'data',format:'json'});
 }
 const params = new URLSearchParams({limit:'12',fields:'key,title,author_name,editions,editions.key,editions.title,editions.language,editions.publisher,editions.publish_date',});
 if (mode === 'title') params.set('title',value);
 else if (mode === 'author') params.set('author',value);
 else if (mode === 'series') params.set('q',value);
 else throw Error('Choose ISBN, title, author, or series and issue.');
 return '/search.json?' + params;
}
export function mapEdition(data) {
 const id = String(data.url || data.key || '').match(/\/(?:books|b)\/(OL\d+M)/)?.[1] || '';
 const identifiers = data.identifiers || {};
 const isbn = [...(identifiers.isbn_13 || []),...(identifiers.isbn_10 || [])].find(valid) || '';
 return {openlibrary_id:id,title:data.title || '',author:[...new Set((data.authors || []).map(a=>a.name).filter(Boolean))].join(' / '),publisher:(data.publishers || []).map(p=>p.name).filter(Boolean).join(' / '),isbn:normalize(isbn),year:String(data.publish_date || '').match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[0] || '',date:data.publish_date || '',format:'',language:'',edition:'',series:'',issue:'',illustrator:''};
}
export function mapSearch(data) {
 return (data.docs || []).flatMap(work=>(work.editions?.docs || []).map(edition=>({openlibrary_id:String(edition.key || '').replace('/books/',''),title:edition.title || work.title || '',author:[...new Set(work.author_name || [])].join(' / '),publisher:(edition.publisher || []).join(' / '),date:(edition.publish_date || []).join(' / '),needs_details:true}))).filter(row=>/^OL\d+M$/.test(row.openlibrary_id));
}
