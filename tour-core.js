(() => {
  function collection(item) {
    if (['books', 'comics'].includes(item.publication_details?.kind)) return item.publication_details.kind;
    const category = String(item.category?.name || item.category || '').toLowerCase();
    if (['books', 'comics'].includes(category)) return category;
    const type = String(item.type?.name || item.type || item.item_type || '').trim().toLowerCase();
    if (!['merch', 'merchandise'].includes(type) && (item.music_details || /^(lp|vinyl|cd|sacd|cassette|audio cassette|tape|minidisc|7-inch single|12-inch single|ep|vinyl record|record|shellac|reel-to-reel)$/.test(type))) return 'music';
    return 'index';
  }
  function isRoom(item) {
    return [...(item.tags || []), ...(item.item_tags || []).map(r => r.tags?.name)].some(t => ['80s-room', 'home-cinema', 'house'].includes(String(t?.name || t || '').trim().toLowerCase()));
  }
  function imageUrl(path) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..') || /[:\\]/.test(path)) return '';
    const base = (globalThis.NEOCACHE_CONFIG?.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
    return `${base}/storage/v1/object/public/images/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  function point(clientX, clientY, rect) {
    return {x: Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (clientY - rect.top) / rect.height * 100))};
  }
  async function pages(request, query) {
    const all = [];
    for (;;) {
      const rows = await request(`${query}${query.includes('?') ? '&' : '?'}limit=100&offset=${all.length}`);
      if (!Array.isArray(rows)) throw Error('Invalid server response');
      if (!rows.length) return all;
      all.push(...rows);
    }
  }
  function element(tag, text, className = '') {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
  }
  globalThis.NeoTour = {collection, isRoom, imageUrl, point, pages, element,
    itemHref: item => `${collection(item)}.html?item=${encodeURIComponent(item.slug || item.id)}`};
})();
