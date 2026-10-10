(() => {
  const norm = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const code = value => norm(value).replace(/[\s-]/g, '');
  function isbn(value) {
    let result = code(value).toUpperCase();
    if (!window.NeoCacheISBN.valid(result)) return '';
    if (result.length === 10) {
      result = '978' + result.slice(0, 9);
      const sum = [...result].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
      result += (10 - sum % 10) % 10;
    }
    return result;
  }
  const barcode = value => /^\d{8}$|^\d{12,14}$/.test(code(value)) ? code(value).padStart(14, '0') : '';
  const same = (a, b, normalize = norm) => Boolean(normalize(a)) && normalize(a) === normalize(b);
  function kind(item) {
    if (item.publication_details?.kind) return item.publication_details.kind;
    if (['books','comics'].includes(norm(item.category))) return norm(item.category);
    if (['merch','merchandise'].includes(norm(item.type))) return 'artifact';
    if (item.music_details || /^(lp|vinyl|cd|sacd|cassette|audio cassette|tape|minidisc|7-inch single|12-inch single|ep|vinyl record|record|shellac|reel-to-reel)$/.test(norm(item.type))) return 'music';
    return 'artifact';
  }
  function matches(candidate, items) {
    return items.flatMap(item => {
      if ((item.item_tags || []).some(r => ['80s-room','home-cinema','house'].includes(norm(r.tags?.name)))) return [];
      const reasons = [], category = kind(item), music = item.music_details || {}, publication = item.publication_details || {};
      if (candidate.record_kind === 'music' && category === 'music') {
        if (same(candidate.music_barcode, music.barcode, barcode)) reasons.push('Same barcode');
        if (same(candidate.music_musicbrainz_release_id, music.musicbrainz_release_id)) reasons.push('Same MusicBrainz release');
        if (same(candidate.music_discogs_release_id, music.discogs_release_id)) reasons.push('Same Discogs release');
        if (same(candidate.music_catalog_number, music.catalog_number, code) && same(candidate.music_artist, music.artist)) reasons.push('Same artist and catalog number');
      } else if (['books','comics'].includes(candidate.record_kind) && ['books','comics'].includes(category)) {
        if (same(candidate.publication_isbn, publication.isbn, isbn)) reasons.push('Same ISBN');
        if (same(candidate.publication_openlibrary_id, publication.openlibrary_id)) reasons.push('Same Open Library edition');
      }
      if (category === candidate.record_kind && same(candidate.title, item.title)) reasons.push('Same title — check the edition/model');
      return reasons.length ? [{item, reasons, category}] : [];
    });
  }
  window.NeoCacheDuplicates = {matches};
  const form = document.querySelector('#item-form');
  if (!form) return;
  const panel = document.querySelector('#duplicate-warning');
  const message = document.querySelector('#duplicate-message');
  const list = document.querySelector('#duplicate-list');
  const confirm = document.querySelector('#duplicate-confirm');
  const approval = document.querySelector('#duplicate-approval');
  let generation = 0, timer, signature = '', latestForm = ''; 
  const candidate = () => Object.fromEntries(new FormData(form));
  function clear() {
    generation++;
    clearTimeout(timer);
    signature = '';
    confirm.checked = false;
    panel.hidden = true;
  }
  async function check(overrides = {}, saving = false, snapshot = null) {
    latestForm = JSON.stringify(candidate());
    const current = ++generation;
    const values = {...(snapshot || candidate()), ...overrides};
    if (!session?.access_token) return false;
    try {
      const items = [];
      for (let offset = 0;;) {
        const page = await restRequest(`items?select=${encodeURIComponent('id,title,type,category,item_tags(tags(name)),music_details(*),publication_details(*)')}&order=id&limit=100&offset=${offset}`);
        if (current !== generation) return false;
        items.push(...page);
        if (!page.length) break;
        offset += page.length;
      }
      const found = matches(values, items);
      const nextSignature = JSON.stringify([values, found.map(match => [match.item.id, match.reasons])]);
      if (nextSignature !== signature) confirm.checked = false;
      signature = nextSignature;
      list.replaceChildren();
      panel.hidden = !found.length;
      approval.hidden = !found.length;
      message.textContent = 'POSSIBLE DUPLICATE // Already in your collection';
      for (const match of found) {
        const li = document.createElement('li');
        const link = document.createElement('a');
        const page = {artifact:'index',music:'music',books:'books',comics:'comics'}[match.category];
        link.href = `${page}.html?item=${encodeURIComponent(match.item.id)}`;
        link.target = '_blank'; link.rel = 'noopener';
        link.textContent = match.item.title || 'Untitled';
        li.append(link, document.createTextNode(` — ${match.reasons.join('; ')}`));
        list.append(li);
      }
      if (saving && found.length && !confirm.checked) panel.scrollIntoView({block:'center'});
      return !found.length || confirm.checked;
    } catch {
      if (current !== generation) return false;
      signature = ''; confirm.checked = false;
      panel.hidden = false; approval.hidden = true; list.replaceChildren();
      message.textContent = 'DUPLICATE CHECK UNAVAILABLE // Please retry before saving.';
      return false;
    }
  }
  function schedule(event) {
    if (event.target === confirm) return;
    const fingerprint = JSON.stringify(candidate());
    if (fingerprint === latestForm) return;
    latestForm = fingerprint;
    clear();
    timer = setTimeout(() => void check(), 400);
  }
  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('reset', clear);
  document.querySelector('#logout-button')?.addEventListener('click', clear);
  window.NeoCacheDuplicates.check = check;
  window.NeoCacheDuplicates.beforeSave = values => { clearTimeout(timer); return check({}, true, values); };
})();
