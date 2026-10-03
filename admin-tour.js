(() => {
  const T = window.NeoTour, $ = id => document.getElementById(id);
  let scenes = [], items = [], points = [], current = null, busy = false, generation = 0;
  const status = message => { $('at-status').textContent = message; };
  const query = id => encodeURIComponent(id);
  function renderItems() {
    const search = $('at-search').value.trim().toLowerCase();
    const chosen = $('at-item').value;
    $('at-item').replaceChildren(T.element('option', 'Choose an object…'));
    $('at-item').firstChild.value = '';
    for (const item of items.filter(i => !T.isRoom(i) && `${i.title} ${i.type} ${i.category}`.toLowerCase().includes(search))) {
      const option = T.element('option', `${item.title} // ${T.collection(item) === 'index' ? 'archive' : T.collection(item)}`); option.value = item.id; $('at-item').append(option);
    }
    if ([...$('at-item').options].some(o => o.value === chosen)) $('at-item').value = chosen;
  }
  function renderPoints() {
    $('at-points').replaceChildren(); $('at-list').replaceChildren();
    for (const [index, point] of points.entries()) {
      const item = items.find(i => i.id === point.item_id);
      const name = item?.title || 'Unavailable item';
      const marker = T.element('button', String(index + 1), 'tour-point'); marker.type = 'button';
      marker.style.left = `${point.x}%`; marker.style.top = `${point.y}%`; marker.setAttribute('aria-label', `Edit marker for ${name}`);
      const edit = () => { $('at-search').value = ''; renderItems(); $('at-item').value = point.item_id; $('at-x').value = point.x; $('at-y').value = point.y; status('Marker selected. Change its position and save.'); };
      marker.addEventListener('click', event => { event.stopPropagation(); edit(); }); $('at-points').append(marker);
      const li = T.element('li', `${name} `), editButton = T.element('button', 'EDIT'), remove = T.element('button', 'REMOVE');
      editButton.type = remove.type = 'button'; editButton.addEventListener('click', edit);
      remove.setAttribute('aria-label', `Remove marker for ${name}`);
      remove.addEventListener('click', () => perform(async () => {
        await restRequest(`room_tour_points?id=eq.${query(point.id)}`, {method: 'DELETE'});
        points = points.filter(p => p.id !== point.id); renderPoints(); status('Marker removed. The collection item is unchanged.');
      }));
      li.append(editButton, remove); $('at-list').append(li);
    }
  }
  async function selectScene() {
    const version = ++generation;
    current = scenes.find(s => s.id === $('at-scene').value) || null;
    $('at-edit').hidden = true; points = []; renderPoints();
    if (!current) return;
    const selected = current;
    $('at-edit-title').value = selected.title; $('at-published').checked = selected.published;
    $('at-photo').src = T.imageUrl(selected.preview_path); $('at-photo').alt = selected.title;
    $('at-x').value = ''; $('at-y').value = ''; $('at-item').value = '';
    $('at-open').href = `tour.html?scene=${encodeURIComponent(selected.id)}`;
    try {
      const loaded = await T.pages(restRequest, `room_tour_points?select=*&scene_id=eq.${query(selected.id)}&order=id.asc`);
      if (version !== generation || !session) return;
      points = loaded; renderPoints(); $('at-edit').hidden = false;
    } catch { if (version === generation) status('Could not load markers. Use Refresh tour.'); }
  }
  async function load() {
    const version = ++generation;
    status('Loading tour editor…'); $('at-edit').hidden = true;
    try {
      const [nextScenes, nextItems] = await Promise.all([
        T.pages(restRequest, 'room_tour_scenes?select=*&order=created_at.asc,id.asc'),
        T.pages(restRequest, 'items?select=*,music_details(*),publication_details(*),item_tags(tags(name))&order=title.asc,id.asc')
      ]);
      if (version !== generation || !session) return;
      scenes = nextScenes; items = nextItems;
      const selectedId = current?.id;
      $('at-scene').replaceChildren(T.element('option', 'Choose a view…')); $('at-scene').firstChild.value = '';
      scenes.forEach(s => { const o = T.element('option', `${s.title}${s.published ? '' : ' (unpublished)'}`); o.value = s.id; $('at-scene').append(o); });
      renderItems(); status(scenes.length ? 'Choose a view to place markers.' : 'Upload your first room photograph below.');
      if (scenes.some(s => s.id === selectedId)) { $('at-scene').value = selectedId; await selectScene(); }
    } catch { if (version === generation) status('Tour editor unavailable. Check the Room Tour database setup and try Refresh tour.'); }
  }
  async function perform(action) {
    if (busy || !session) return;
    busy = true;
    const controls = [...$('tour-admin').querySelectorAll('button,input,select')];
    const disabled = controls.map(c => c.disabled); controls.forEach(c => { c.disabled = true; });
    try { await action(); } catch (error) { status(`Could not save: ${error.message}. Your fields are retained; refresh to check the saved state before retrying.`); }
    finally { busy = false; controls.forEach((c,i) => { c.disabled = disabled[i]; }); }
  }
  async function preview(file) {
    const url = URL.createObjectURL(file), image = new Image();
    try {
      image.src = url; await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) throw Error('Use an image of at most 50 megapixels');
      const canvas = document.createElement('canvas'), scale = Math.min(1, 1400 / image.naturalWidth);
      canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
      if (!blob) throw Error('Could not generate preview'); return blob;
    } finally { URL.revokeObjectURL(url); }
  }
  $('at-upload').addEventListener('submit', event => {
    event.preventDefault();
    void perform(async () => {
      const title = $('at-title').value.trim(), file = $('at-file').files[0];
      if (!title || title.length > 160) throw Error('Enter a title of 1–160 characters');
      const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
      if (!file || !extensions[file.type] || file.size > 20 * 1024 * 1024) throw Error('Choose a JPEG, PNG or WebP image up to 20 MB');
      // Preflight before storage writes; publish only after markers have been placed.
      await restRequest('room_tour_scenes?select=id&limit=1');
      const small = await preview(file), id = crypto.randomUUID();
      const original = `room-tour/${id}.${extensions[file.type]}`, thumbnail = `room-tour/${id}-preview.jpg`;
      status('Uploading original and preview…');
      await uploadImage(file, original); await uploadImage(small, thumbnail);
      // Keep files on uncertain failures; never delete a possibly referenced photo.
      const saved = await restRequest('room_tour_scenes', {method: 'POST', headers: {Prefer:'return=representation'}, body: JSON.stringify({id,title,image_path:original,preview_path:thumbnail,published:false})});
      if (!saved?.[0]) throw Error('Server did not confirm the new view');
      current = saved[0]; $('at-upload').reset(); await load(); status('View saved as unpublished. Add markers, then publish it.');
    });
  });
  $('at-settings').addEventListener('submit', event => { event.preventDefault(); void perform(async () => {
    const title = $('at-edit-title').value.trim(); if (!current || !title) throw Error('Choose a view and enter its title');
    const rows = await restRequest(`room_tour_scenes?id=eq.${query(current.id)}`, {method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({title,published:$('at-published').checked})});
    if (!rows?.[0]) throw Error('No view was updated'); Object.assign(current, rows[0]); await load(); status('View settings saved.');
  }); });
  $('at-marker-form').addEventListener('submit', event => { event.preventDefault(); void perform(async () => {
    const itemId = $('at-item').value, x = Number($('at-x').value), y = Number($('at-y').value);
    if (!current || !items.some(i => i.id === itemId && !T.isRoom(i)) || !$('at-x').value || !$('at-y').value || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) throw Error('Choose an object and a position on the image');
    const existing = points.find(p => p.item_id === itemId);
    const rows = await restRequest(existing ? `room_tour_points?id=eq.${query(existing.id)}` : 'room_tour_points', {method:existing?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({scene_id:current.id,item_id:itemId,x,y})});
    if (!rows?.[0]) throw Error('No marker was saved');
    if (existing) Object.assign(existing,rows[0]); else points.push(rows[0]);
    renderPoints(); status('Marker saved.');
  }); });
  $('at-canvas').addEventListener('click', event => {
    if (busy || !$('at-photo').naturalWidth) return;
    const p = T.point(event.clientX,event.clientY,$('at-photo').getBoundingClientRect());
    $('at-x').value = p.x.toFixed(3); $('at-y').value = p.y.toFixed(3);
    status('Position selected. Choose an object and save the marker.');
  });
  $('at-scene').addEventListener('change', selectScene); $('at-search').addEventListener('input', renderItems);
  $('at-refresh').addEventListener('click', load);
  window.addEventListener('neocache-admin-ready', load);
  window.addEventListener('neocache-admin-logout', () => { generation++; current = null; scenes = []; items = []; points = []; $('at-edit').hidden = true; $('at-scene').replaceChildren(); status(''); });
  if (session && !editorPanel.hidden) void load();
})();
