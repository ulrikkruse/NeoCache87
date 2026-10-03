(() => {
  const T = window.NeoTour, $ = id => document.getElementById(id);
  const config = window.NEOCACHE_CONFIG || {};
  const base = (config.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
  let scenes = [], points = [], scene, zoom = 1, revision = 0, hdLoaded = false;
  async function request(query) {
    const response = await fetch(`${base}/rest/v1/${query}`, {headers: {apikey: config.SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${config.SUPABASE_PUBLIC_KEY}`}});
    if (!response.ok) throw Error('Tour unavailable');
    return response.json();
  }
  function setZoom(value) {
    zoom = Math.max(1, Math.min(4, value));
    $('tour-canvas').style.width = `${zoom * 100}%`;
    $('tour-zoom').textContent = `${Math.round(zoom * 100)}%`;
    $('tour-out').disabled = zoom === 1; $('tour-in').disabled = zoom === 4;
    if (zoom === 1) { $('tour-viewport').scrollLeft = 0; $('tour-viewport').scrollTop = 0; }
  }
  function selectPoint(point) {
    const item = point.items;
    $('tour-detail').hidden = false;
    $('tour-item-title').textContent = item.title || 'Untitled';
    $('tour-item-kind').textContent = T.collection(item) === 'index' ? 'ARCHIVE' : T.collection(item).toUpperCase();
    $('tour-item-link').href = T.itemHref(item);
    const cover = [...(item.images || [])].sort((a,b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))[0];
    const image = T.imageUrl(cover?.storage_path);
    $('tour-item-image').hidden = !image;
    if (image) $('tour-item-image').src = image; else $('tour-item-image').removeAttribute('src');
    $('tour-item-image').onerror = () => { $('tour-item-image').hidden = true; };
    document.querySelectorAll('.tour-point').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.id === point.id)));
    $('tour-item-link').focus({preventScroll: true});
    $('tour-detail').scrollIntoView({block: 'nearest'});
  }
  async function highResolution() {
    if (!scene || hdLoaded || $('tour-hd').disabled) return;
    const version = revision;
    $('tour-hd').disabled = true; $('tour-image-status').textContent = 'Loading high resolution…';
    const image = new Image(); image.src = T.imageUrl(scene.image_path);
    try {
      await image.decode();
      if (version !== revision) return;
      $('tour-photo').src = image.src; hdLoaded = true;
      $('tour-image-status').textContent = 'High resolution ready.';
    } catch {
      if (version !== revision) return;
      $('tour-image-status').textContent = 'High resolution could not load. The preview is still available; try again.';
      $('tour-hd').disabled = false;
    }
  }
  function showScene() {
    revision++; scene = scenes.find(s => s.id === $('tour-scene').value);
    if (!scene) return;
    hdLoaded = false; $('tour-hd').disabled = false; $('tour-image-status').textContent = '';
    $('tour-detail').hidden = true; $('tour-points').replaceChildren(); $('tour-items').replaceChildren();
    $('tour-photo').alt = scene.title; $('tour-photo').src = T.imageUrl(scene.preview_path || scene.image_path);
    $('tour-photo').onerror = () => { $('tour-image-status').textContent = 'The photograph could not load. Try loading high resolution or reload the tour.'; };
    setZoom(1);
    const visible = points.filter(p => p.scene_id === scene.id && p.items && !T.isRoom(p.items));
    visible.forEach((point, i) => {
      const marker = T.element('button', String(i + 1), 'tour-point'); marker.type = 'button'; marker.dataset.id = point.id;
      marker.style.left = `${point.x}%`; marker.style.top = `${point.y}%`;
      marker.title = point.items.title; marker.setAttribute('aria-label', `Discover ${point.items.title}`); marker.setAttribute('aria-pressed', 'false');
      marker.addEventListener('click', () => selectPoint(point)); $('tour-points').append(marker);
      const li = T.element('li', ''); const button = T.element('button', point.items.title || 'Untitled'); button.type = 'button';
      button.addEventListener('click', () => selectPoint(point)); li.append(button); $('tour-items').append(li);
    });
    if (!visible.length) $('tour-items').append(T.element('li', 'Objects will be linked here soon. For now, enjoy the view.'));
  }
  async function load() {
    $('tour-retry').hidden = true; $('tour-content').hidden = true; $('tour-status').textContent = 'Loading the tour…';
    try {
      [scenes, points] = await Promise.all([
        T.pages(request, 'room_tour_scenes?select=*&published=eq.true&order=created_at.asc,id.asc'),
        T.pages(request, 'room_tour_points?select=*,items(id,slug,title,type,category,images(*),music_details(*),publication_details(*),item_tags(tags(name)))&order=id.asc')
      ]);
      scenes = scenes.filter(s => T.imageUrl(s.image_path));
      if (!scenes.length) { $('tour-status').textContent = 'The room tour is being prepared. Check back soon.'; return; }
      $('tour-scene').replaceChildren(...scenes.map(s => { const option = T.element('option', s.title); option.value = s.id; return option; }));
      const requested = new URLSearchParams(location.search).get('scene');
      if (scenes.some(s => s.id === requested)) $('tour-scene').value = requested;
      $('tour-content').hidden = false; $('tour-status').textContent = ''; showScene();
    } catch { $('tour-status').textContent = 'The tour could not load. Please try again.'; $('tour-retry').hidden = false; }
  }
  $('tour-scene').addEventListener('change', showScene);
  $('tour-in').addEventListener('click', () => { setZoom(zoom + .5); void highResolution(); });
  $('tour-out').addEventListener('click', () => setZoom(zoom - .5));
  $('tour-reset').addEventListener('click', () => setZoom(1));
  $('tour-hd').addEventListener('click', highResolution);
  $('tour-markers').addEventListener('click', () => { $('tour-points').hidden = !$('tour-points').hidden; $('tour-markers').setAttribute('aria-pressed', String(!$('tour-points').hidden)); });
  $('tour-retry').addEventListener('click', load);
  let drag = null;
  $('tour-viewport').addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || zoom === 1 || event.target.closest('button')) return;
    event.preventDefault();
    drag = {x:event.clientX,y:event.clientY,left:$('tour-viewport').scrollLeft,top:$('tour-viewport').scrollTop};
    $('tour-viewport').setPointerCapture(event.pointerId);
  });
  $('tour-viewport').addEventListener('pointermove', event => {
    if (!drag) return;
    $('tour-viewport').scrollLeft = drag.left + drag.x - event.clientX;
    $('tour-viewport').scrollTop = drag.top + drag.y - event.clientY;
  });
  $('tour-viewport').addEventListener('pointerup', () => { drag = null; });
  $('tour-viewport').addEventListener('pointercancel', () => { drag = null; });
  load();
})();
