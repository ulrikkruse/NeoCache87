(() => {
  const {element, pages} = NeoTour, field = name => document.getElementById(`press-${name}`);
  const params = new URLSearchParams(location.search), articleId = params.get('article');
  let articles = [], articlePages = [], generation = 0, viewerGeneration = 0, currentPage = 0;
  const urls = new Set(), cache = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); entry.target.loadCover?.(); }
  }, {rootMargin: '200px'});
  field('copyright-year').textContent = new Date().getFullYear();
  function cleanup() { generation++; observer.disconnect(); urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); cache.clear(); }
  async function photo(path, version) {
    if (!cache.has(path)) cache.set(path, NeoPress.photo(path).then(url => {
      if (version !== generation) { URL.revokeObjectURL(url); throw Error('View changed'); }
      urls.add(url); return url;
    }).catch(error => { if (version === generation) cache.delete(path); throw error; }));
    return cache.get(path);
  }
  function meta(row) { return [row.publication || 'Publication unknown', NeoPress.dateLabel(row), row.language, row.article_type].join(' · '); }
  function filters() { return {year: field('year').value, language: field('language').value, type: field('type').value, search: field('search').value}; }
  function renderList() {
    cleanup(); const version = generation;
    field('list').replaceChildren();
    const rows = articles.filter(row => NeoPress.matches(row, filters()));
    field('status').textContent = !articles.length ? 'The first clippings are still being gathered. Come back soon.' : !rows.length ? 'No articles match your filters.' : `${rows.length} ${rows.length === 1 ? 'article' : 'articles'}`;
    for (const row of rows) {
      const card = element('article', '', 'press-card'), cover = element('div', 'NO SCAN YET', 'press-cover');
      const heading = element('h2', ''), link = element('a', row.title);
      link.href = `press.html?article=${encodeURIComponent(row.id)}`; heading.append(link);
      card.append(cover, heading, element('p', meta(row), 'press-meta'));
      if (row.description) card.append(element('p', row.description.length > 180 ? row.description.slice(0, 180) + '…' : row.description));
      field('list').append(card);
      if (row.press_pages?.[0]) {
        cover.textContent = 'Loading scan…';
        cover.loadCover = async () => {
          try {
            const src = await photo(row.press_pages[0].path, version);
            if (version !== generation) return;
            const img = element('img', ''); img.src = src; img.alt = row.press_pages[0].caption || row.title;
            img.addEventListener('error', () => { if (version === generation) cover.textContent = 'Scan unavailable'; });
            cover.replaceChildren(img);
          } catch { if (version === generation) cover.textContent = 'Scan unavailable. Open the article to retry.'; }
        };
        observer.observe(cover);
      }
    }
  }
  function choices(name, values, label) {
    field(name).replaceChildren(new Option(label, ''));
    for (const [value, text] of values) field(name).add(new Option(text, value));
  }
  async function showPage(index) {
    currentPage = index; const version = generation, request = ++viewerGeneration, row = articlePages[index];
    field('full-image').hidden = true; field('full-image').removeAttribute('src');
    field('image-stage').classList.remove('zoomed'); field('image-stage').scrollTo(0, 0);
    field('zoom').setAttribute('aria-pressed', 'false'); field('zoom').textContent = 'ZOOM IN'; field('zoom').disabled = true;
    field('prev').disabled = index === 0; field('next').disabled = index === articlePages.length - 1;
    field('position').textContent = `PAGE ${index + 1} / ${articlePages.length}`;
    field('caption').textContent = row.caption; field('image-status').textContent = 'Loading scan…'; field('image-retry').hidden = true;
    if (!field('viewer').open) field('viewer').showModal();
    try {
      const src = await photo(row.path, version);
      if (request !== viewerGeneration || version !== generation) return;
      field('full-image').src = src; field('full-image').alt = row.caption || `Article page ${index + 1}`;
      await field('full-image').decode();
      if (request !== viewerGeneration || version !== generation) return;
      field('full-image').hidden = false; field('zoom').disabled = false; field('image-status').textContent = '';
    } catch {
      if (request !== viewerGeneration || version !== generation) return;
      cache.delete(row.path); field('image-status').textContent = 'This scan could not be loaded.'; field('image-retry').hidden = false;
    }
  }
  async function load() {
    cleanup(); const version = generation;
    field('retry').hidden = true; field('filters').hidden = true; field('article').hidden = true;
    field('list').replaceChildren(); field('article').replaceChildren(); field('status').textContent = 'Loading articles…';
    field('back').hidden = !articleId;
    try {
      const query = 'press_articles?select=*,press_pages(id,path,caption)&published=eq.true&order=year.desc.nullslast,publication_date.desc.nullslast,created_at.desc,id.asc&press_pages.order=position.asc,created_at.asc,id.asc&press_pages.limit=1';
      const rows = await pages(NeoPress.read, query + (articleId ? `&id=eq.${encodeURIComponent(articleId)}` : ''));
      if (version !== generation) return;
      if (!articleId) {
        articles = rows;
        choices('year', [...new Set(rows.map(r => r.year))].sort((a,b) => (b || 0) - (a || 0)).map(y => [String(y || 'unknown'), y ? String(y) : 'DATE UNKNOWN']), 'ALL YEARS');
        choices('language', [...new Map(rows.map(r => [NeoPress.normalize(r.language), r.language])).entries()].sort((a,b) => a[1].localeCompare(b[1])), 'ALL LANGUAGES');
        choices('type', [...new Set(rows.map(r => r.article_type))].sort().map(t => [t,t]), 'ALL TYPES');
        field('filters').hidden = !rows.length; renderList(); return;
      }
      const row = rows[0];
      if (!row) { field('status').textContent = 'This article is not available.'; return; }
      const scans = await pages(NeoPress.read, `press_pages?select=*&article_id=eq.${encodeURIComponent(row.id)}&order=position.asc,created_at.asc,id.asc`);
      if (version !== generation) return;
      articlePages = scans; document.title = `${row.title} // Press Archive`;
      field('status').textContent = ''; field('article').hidden = false;
      field('article').append(element('h2', row.title), element('p', meta(row), 'press-meta'));
      for (const [label, text] of [['Description',row.description],['Collection notes',row.notes]]) if (text) field('article').append(element('h3', label), element('p', text, 'press-text'));
      field('article').append(element('h3', 'Scanned pages'), element('p', scans.length ? 'Choose a page to read it. Zoom in to explore the details.' : 'No scans have been added to this article yet.'));
      const buttons = element('div', '', 'press-pages');
      scans.forEach((scan, i) => { const button = element('button', `PAGE ${i+1}${scan.caption ? ' — ' + scan.caption : ''}`); button.type = 'button'; button.addEventListener('click', () => void showPage(i)); buttons.append(button); });
      field('article').append(buttons);
    } catch { if (version === generation) { field('status').textContent = 'Press Archive could not be loaded. Please try again.'; field('retry').hidden = false; } }
  }
  field('filters').addEventListener('submit', event => event.preventDefault());
  field('filters').addEventListener('input', renderList);
  field('filters').addEventListener('reset', event => { event.preventDefault(); for (const name of ['year','language','type','search']) field(name).value = ''; renderList(); });
  field('retry').addEventListener('click', () => void load());
  field('prev').addEventListener('click', () => void showPage(currentPage-1)); field('next').addEventListener('click', () => void showPage(currentPage+1));
  field('image-retry').addEventListener('click', () => void showPage(currentPage));
  field('close').addEventListener('click', () => field('viewer').close());
  field('viewer').addEventListener('close', () => { viewerGeneration++; field('full-image').removeAttribute('src'); });
  field('zoom').addEventListener('click', () => { const zoomed = field('image-stage').classList.toggle('zoomed'); field('zoom').setAttribute('aria-pressed', String(zoomed)); field('zoom').textContent = zoomed ? 'FIT PAGE' : 'ZOOM IN'; });
  void load();
})();
