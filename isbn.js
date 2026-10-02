(() => {
function normalize(value) { return String(value || '').replace(/[\s-]/g, '').toUpperCase(); }
function valid(value) {
 const isbn = normalize(value);
 if (/^\d{9}[\dX]$/.test(isbn)) return [...isbn].reduce((sum,c,i)=>sum+(c==='X'?10:Number(c))*(10-i),0)%11===0;
 if (/^97[89]\d{10}$/.test(isbn)) return [...isbn].reduce((sum,c,i)=>sum+Number(c)*(i%2?3:1),0)%10===0;
 return false;
}

window.NeoCacheISBN = {normalize, valid};
})();
