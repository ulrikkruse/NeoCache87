(() => {
  const root = document.getElementById('press-admin'), field = name => document.getElementById(`ap-${name}`);
  const {element, pages} = NeoTour;
  let records = [], selected = null, photos = [], generation = 0, busy = false;
  const urls = new Set();
  function release() { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); }
  function message(text) { field('status').textContent = text; }
  function picker() {
    field('select').replaceChildren(new Option('NEW ARTICLE…', ''));
    for (const row of records) field('select').add(new Option(`${row.published ? 'PUBLISHED' : 'DRAFT'} // ${row.title}`, row.id));
    field('select').value = selected?.id || '';
  }
  function clear() {
    generation++; release(); selected = null; photos = [];
    field('form').reset(); field('photos').replaceChildren(); field('album').hidden = true;
    field('open').hidden = true; field('select').value = '';
  }
  async function action(work) {
    if (busy || !session) return;
    busy = true;
    const version = generation;
    const controls = [...root.querySelectorAll('button,input,textarea,select')];
    controls.forEach(control => { control.disabled = true; });
    try { await work(); }
    catch (error) { if (version === generation) message(error.message || 'Could not save. Please try again.'); }
    finally { busy = false; controls.forEach(control => { control.disabled = false; }); }
  }
  async function refresh() {
    await action(async () => {
      const version = generation;
      message('Loading articles…');
      const rows = await pages(restRequest, 'press_articles?select=*&order=created_at.desc,id.asc');
      if (version !== generation) return;
      records = rows; picker();
      message('Choose an article or start a new draft.');
    });
  }
  async function renderPhotos(version) {
    release(); field('photos').replaceChildren();
    for (const photo of photos) {
      const figure = element('figure', '');
      const label = element('label', 'CAPTION'), input = element('textarea', '');
      input.value = photo.caption; input.maxLength = 500; label.append(input);
      const positionLabel = element('label', 'ORDER (LOWEST NUMBER IS THE COVER)'), position = element('input', '');
      position.type = 'number'; position.min = '0'; position.step = '1'; position.value = photo.position; positionLabel.append(position);
      const save = element('button', 'SAVE CAPTION / ORDER'); save.type = 'button';
      save.addEventListener('click', () => action(async () => {
        if (!position.validity.valid || position.value === '') throw Error('Enter a whole number of zero or more.');
        const values = {caption: input.value.trim(), position: Number(position.value)};
        await restRequest(`press_pages?id=eq.${encodeURIComponent(photo.id)}`, {method: 'PATCH', body: JSON.stringify(values)});
        if (version !== generation) return;
        Object.assign(photo, values); message('Caption and order saved.');
      }));
      figure.append(label, positionLabel, save); field('photos').append(figure);
      void NeoPress.photo(photo.path, session.access_token).then(url => {
        if (version !== generation) { URL.revokeObjectURL(url); return; }
        urls.add(url); const img = element('img', ''); img.src = url; img.alt = photo.caption || 'Article scan'; figure.prepend(img);
      }).catch(() => { if (version === generation) figure.prepend(element('p', 'Photo preview unavailable. Select this article again to retry.')); });
    }
  }
  field('select').addEventListener('change', () => {
    const id = field('select').value; clear();
    selected = records.find(row => row.id === id) || null; picker();
    if (!selected) { message('New article. Save the article before adding scans.'); return; }
    for (const name of ['title','publication','year','publication_date','language','article_type','description','notes']) field(name).value = selected[name] ?? '';
    field('published').checked = selected.published;
    field('open').href = `press.html?article=${encodeURIComponent(selected.id)}`; field('open').hidden = !selected.published;
    void action(async () => {
      const version = generation;
      const rows = await pages(restRequest, `press_pages?select=*&article_id=eq.${encodeURIComponent(selected.id)}&order=position.asc,created_at.asc,id.asc`);
      if (version !== generation) return;
      photos = rows; field('album').hidden = false; void renderPhotos(version); message('Article ready to edit.');
    });
  });
  field('form').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      const version = generation, id = selected?.id || crypto.randomUUID();
      const values = Object.fromEntries(['title','publication','year','publication_date','language','article_type','description','notes'].map(name => [name, field(name).value.trim()]));
      if (!values.title || !values.language) throw Error('A title and language are required.');
      values.year = values.year ? Number(values.year) : null;
      values.publication_date = values.publication_date || null;
      if (values.publication_date) values.year = Number(values.publication_date.slice(0,4));
      if (values.year !== null && (!Number.isInteger(values.year) || values.year < 1900 || values.year > 2100)) throw Error('Enter a year between 1900 and 2100.');
      field('year').value = values.year ?? '';
      values.published = field('published').checked;
      const rows = await restRequest(selected ? `press_articles?id=eq.${encodeURIComponent(id)}` : 'press_articles', {method: selected ? 'PATCH' : 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify({...values, id})});
      if (version !== generation) return;
      if (!rows?.[0]) throw Error('No saved article was returned. Refresh before retrying.');
      const index = records.findIndex(row => row.id === id); selected = rows[0];
      if (index < 0) records.unshift(selected); else records[index] = selected;
      picker(); field('album').hidden = false;
      field('open').href = `press.html?article=${encodeURIComponent(id)}`; field('open').hidden = !selected.published;
      message(selected.published ? 'Article published.' : 'Draft saved. Only you can read it and its scans.');
    });
  });
  field('upload').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      if (!selected) throw Error('Save the article first.');
      const file = field('file').files[0], extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
      if (!file || !extensions[file.type] || file.size > 20 * 1024 * 1024) throw Error('Choose a JPEG, PNG or WebP scan up to 20 MB.');
      const version = generation, id = selected.id, token = session.access_token;
      const path = `${id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      message('Uploading scan…');
      await NeoPress.request(`storage/v1/object/press/${path}`, {method: 'POST', headers: {'Content-Type': file.type, 'x-upsert': 'false'}, body: file}, token);
      if (version !== generation || !session) return;
      try {
        const rows = await restRequest('press_pages', {method: 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify({article_id: id, path, caption: field('caption').value.trim(), position: photos.length ? Math.max(...photos.map(p => p.position)) + 1 : 0})});
        if (version !== generation) return;
        if (!rows?.[0]) throw Error('Scan record was not returned. Refresh before trying again.');
        photos.push(rows[0]); void renderPhotos(version); field('upload').reset(); message('Scan added to the album.');
      } catch (error) {
        // Never delete on an uncertain response: the scan record might have committed.
        throw Error(`${error.message} The uploaded file is retained in Storage; refresh before retrying.`);
      }
    });
  });
  field('new').addEventListener('click', () => { clear(); message('New article. Save the article before adding scans.'); });
  field('refresh').addEventListener('click', () => { clear(); void refresh(); });
  field('publication_date').addEventListener('change', () => { if (field('publication_date').value) field('year').value = field('publication_date').value.slice(0,4); });
  window.addEventListener('neocache-admin-ready', () => { clear(); void refresh(); });
  window.addEventListener('neocache-admin-logout', () => { clear(); records = []; picker(); message(''); });
  if (session && !editorPanel.hidden) void refresh();
})();
