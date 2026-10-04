(() => {
  const root = document.getElementById('memory-admin'), field = name => document.getElementById(`am-${name}`);
  const {element, pages} = NeoTour;
  let records = [], selected = null, photos = [], generation = 0, busy = false;
  const urls = new Set();
  function release() { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); }
  function message(text) { field('status').textContent = text; }
  function picker() {
    field('select').replaceChildren(new Option('NEW MEMORY…', ''));
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
      message('Loading memories…');
      const [rows, items] = await Promise.all([
        pages(restRequest, 'memories?select=*&order=created_at.desc,id.asc'),
        pages(restRequest, 'items?select=id,title&order=title.asc,id.asc')
      ]);
      if (version !== generation) return;
      records = rows; picker();
      field('item').replaceChildren(new Option('No linked object', ''));
      for (const item of items) field('item').add(new Option(item.title, item.id));
      message('Choose a memory or start a new draft.');
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
        await restRequest(`memory_photos?id=eq.${encodeURIComponent(photo.id)}`, {method: 'PATCH', body: JSON.stringify(values)});
        if (version !== generation) return;
        Object.assign(photo, values); message('Caption and order saved.');
      }));
      figure.append(label, positionLabel, save); field('photos').append(figure);
      void NeoMemory.photo(photo.path, session.access_token).then(url => {
        if (version !== generation) { URL.revokeObjectURL(url); return; }
        urls.add(url); const img = element('img', ''); img.src = url; img.alt = photo.caption || 'Memory photograph'; figure.prepend(img);
      }).catch(() => { if (version === generation) figure.prepend(element('p', 'Photo preview unavailable. Select this memory again to retry.')); });
    }
  }
  field('select').addEventListener('change', () => {
    const id = field('select').value; clear();
    selected = records.find(row => row.id === id) || null; picker();
    if (!selected) { message('New memory. Save your story before adding photographs.'); return; }
    for (const name of ['title','period','place','theme','body']) field(name).value = selected[name];
    field('published').checked = selected.published; field('item').value = selected.related_item_id || '';
    field('open').href = `memories.html?memory=${encodeURIComponent(selected.id)}`; field('open').hidden = !selected.published;
    void action(async () => {
      const version = generation;
      const rows = await pages(restRequest, `memory_photos?select=*&memory_id=eq.${encodeURIComponent(selected.id)}&order=position.asc,created_at.asc,id.asc`);
      if (version !== generation) return;
      photos = rows; field('album').hidden = false; void renderPhotos(version); message('Memory ready to edit.');
    });
  });
  field('form').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      const version = generation, id = selected?.id || crypto.randomUUID();
      const values = Object.fromEntries(['title','period','place','theme','body'].map(name => [name, field(name).value.trim()]));
      if (!values.title || !values.body) throw Error('A title and story are required.');
      values.published = field('published').checked; values.related_item_id = field('item').value || null;
      const rows = await restRequest(selected ? `memories?id=eq.${encodeURIComponent(id)}` : 'memories', {method: selected ? 'PATCH' : 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify({...values, id})});
      if (version !== generation) return;
      if (!rows?.[0]) throw Error('No saved memory was returned. Refresh before retrying.');
      const index = records.findIndex(row => row.id === id); selected = rows[0];
      if (index < 0) records.unshift(selected); else records[index] = selected;
      picker(); field('album').hidden = false;
      field('open').href = `memories.html?memory=${encodeURIComponent(id)}`; field('open').hidden = !selected.published;
      message(selected.published ? 'Memory published.' : 'Draft saved. Only you can read it and its photographs.');
    });
  });
  field('upload').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      if (!selected) throw Error('Save the memory first.');
      const file = field('file').files[0], extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
      if (!file || !extensions[file.type] || file.size > 20 * 1024 * 1024) throw Error('Choose a JPEG, PNG or WebP photograph up to 20 MB.');
      const version = generation, id = selected.id, token = session.access_token;
      const path = `${id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      message('Uploading photograph…');
      await NeoMemory.request(`storage/v1/object/memories/${path}`, {method: 'POST', headers: {'Content-Type': file.type, 'x-upsert': 'false'}, body: file}, token);
      try {
        const rows = await restRequest('memory_photos', {method: 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify({memory_id: id, path, caption: field('caption').value.trim(), position: photos.length ? Math.max(...photos.map(p => p.position)) + 1 : 0})});
        if (version !== generation) return;
        if (!rows?.[0]) throw Error('Photo record was not returned. Refresh before trying again.');
        photos.push(rows[0]); void renderPhotos(version); field('upload').reset(); message('Photograph added to the album.');
      } catch (error) {
        // Never delete on an uncertain response: the photo record might have committed.
        throw Error(`${error.message} The uploaded file is retained in Storage; refresh before retrying.`);
      }
    });
  });
  field('new').addEventListener('click', () => { clear(); message('New memory. Save your story before adding photographs.'); });
  field('refresh').addEventListener('click', () => { clear(); void refresh(); });
  window.addEventListener('neocache-admin-ready', () => { clear(); void refresh(); });
  window.addEventListener('neocache-admin-logout', () => { clear(); records = []; picker(); message(''); });
  if (session && !editorPanel.hidden) void refresh();
})();
