(() => {
  const config = globalThis.NEOCACHE_CONFIG || {};
  const base = (config.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
  const key = config.SUPABASE_PUBLIC_KEY || config.SUPABASE_ANON_KEY;
  async function request(path, options = {}, token = key) {
    const response = await fetch(`${base}/${path}`, {cache: 'no-store', signal: AbortSignal.timeout(60000), ...options, headers: {apikey: key, Authorization: `Bearer ${token}`, ...options.headers}});
    if (!response.ok) throw Error(`Press Archive request failed (${response.status}).`);
    return response;
  }
  async function read(query) { return (await request(`rest/v1/${query}`)).json(); }
  async function photo(path, token) {
    if (!/^[a-f0-9-]+\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(path)) throw Error('Invalid press image path');
    const response = await request(`storage/v1/object/press/${path}`, {}, token);
    return URL.createObjectURL(await response.blob());
  }
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function matches(article, filters) {
    return (!filters.year || String(article.year || 'unknown') === filters.year)
      && (!filters.language || normalize(article.language) === filters.language)
      && (!filters.type || article.article_type === filters.type)
      && (!filters.search || normalize([article.title, article.publication, article.description, article.notes].join(' ')).includes(normalize(filters.search)));
  }
  function dateLabel(article) {
    if (!article.publication_date) return article.year ? String(article.year) : 'Date unknown';
    const [year, month, day] = article.publication_date.split('-');
    return `${day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]} ${year}`;
  }
  globalThis.NeoPress = {request, read, photo, normalize, matches, dateLabel};
})();
