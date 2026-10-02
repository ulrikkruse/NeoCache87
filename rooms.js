(() => {
  const originDialog = document.querySelector('#origin-transmission');
  document.querySelector('#origin-trigger').addEventListener('click', () => originDialog.showModal());
  document.querySelector('#close-origin').addEventListener('click', () => originDialog.close());
  originDialog.addEventListener('click', event => {
    if (event.target === originDialog) originDialog.close();
  });
  const config = window.NEOCACHE_CONFIG || {};
  const projectUrl = (config.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
  const labels = { '80s-room': '80s room', 'home-cinema': 'Home cinema' };
  const grid = document.querySelector('#room-grid');
  const status = document.querySelector('#room-status');
  const count = document.querySelector('#photo-count');
  const retry = document.querySelector('#retry');
  const viewer = document.querySelector('#room-viewer');
  const fullPhoto = document.querySelector('#full-photo');
  const caption = document.querySelector('#photo-caption');
  const previous = document.querySelector('#prev-photo');
  const next = document.querySelector('#next-photo');
  let photos = [], visible = [], selected = 'all', position = 0, loaded = false;

  function imageUrl(image) {
    const source = image.url || image.image_url || image.path || image.storage_path;
    if (typeof source !== 'string' || !source.trim()) return null;
    if (/^https?:\/\//i.test(source)) return source;
    if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith('//')) return null;
    return `${projectUrl}/storage/v1/object/public/images/${source.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`;
  }

  function showPhoto(index) {
    position = (index + visible.length) % visible.length;
    const photo = visible[position];
    fullPhoto.src = photo.url;
    fullPhoto.alt = photo.caption;
    caption.textContent = photo.caption;
    document.querySelector('#photo-position').textContent = `${position + 1} / ${visible.length}`;
    previous.hidden = next.hidden = visible.length < 2;
  }

  function render() {
    visible = photos.filter(photo => selected === 'all' || photo.rooms.includes(selected));
    grid.replaceChildren();
    count.textContent = `${visible.length} ${visible.length === 1 ? "photo" : "photos"}`;
    status.hidden = visible.length > 0;
    status.textContent = selected === 'all' ? 'No photos from the rooms yet. Check back soon.' : `No photos from the ${labels[selected].toLowerCase()} yet.`;
    visible.forEach((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'room-photo';
      button.setAttribute('aria-label', `View photo: ${photo.caption}`);
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption;
      img.loading = 'lazy';
      img.decoding = 'async';
      const text = document.createElement('span');
      const room = document.createElement('small');
      room.textContent = photo.rooms.map(key => labels[key]).join(' / ');
      text.append(room, document.createTextNode(photo.caption));
      img.addEventListener('error', () => { img.hidden = true; text.append(document.createTextNode(' — The photo could not be loaded')); });
      button.append(img, text);
      button.addEventListener('click', () => { showPhoto(index); viewer.showModal(); });
      grid.append(button);
    });
  }

  async function load() {
    loaded = false;
    retry.hidden = true;
    status.hidden = false;
    status.textContent = 'Loading photos from the rooms…';
    count.textContent = 'Loading photos…';
    try {
      if (!projectUrl || !config.SUPABASE_PUBLIC_KEY) throw new Error('Missing configuration');
      const all = [];
      // Fetch every page, including galleries beyond Supabase's default row limit.
      for (let offset = 0; ; ) {
        const query = new URLSearchParams({ select: 'id,title,images(*),item_tags(tags(name))', order: 'created_at.desc,id.asc', offset: String(offset), limit: '100' });
        const response = await fetch(`${projectUrl}/rest/v1/items?${query}`, { headers: { apikey: config.SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${config.SUPABASE_PUBLIC_KEY}` } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = await response.json();
        if (!Array.isArray(items)) throw new Error('Invalid response');
        if (!items.length) break;
        all.push(...items);
        offset += items.length;
      }
      photos = all.flatMap(item => {
        const rooms = [...new Set((item.item_tags || []).map(relation => relation.tags?.name?.toLowerCase()).filter(tag => labels[tag]))];
        if (!rooms.length) return [];
        const images = [...(item.images || [])].sort((a, b) => Number(Boolean(b.is_primary || b.primary)) - Number(Boolean(a.is_primary || a.primary)));
        return images.map(image => ({ url: imageUrl(image), caption: image.caption || image.alt_text || image.title || item.title || 'From the room', rooms })).filter(photo => photo.url);
      });
      loaded = true;
      render();
    } catch (error) {
      status.textContent = 'The photos could not be loaded. Please try again shortly.';
      count.textContent = 'Connection unavailable';
      retry.hidden = false;
    }
  }

  document.querySelectorAll('[data-room]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.room;
    document.querySelectorAll('[data-room]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    if (loaded) render();
  }));
  previous.addEventListener('click', () => showPhoto(position - 1));
  next.addEventListener('click', () => showPhoto(position + 1));
  document.querySelector('#close-viewer').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(position + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  fullPhoto.addEventListener('error', () => { caption.textContent = `${visible[position].caption} — The photo could not be loaded.`; });
  retry.addEventListener('click', load);
  load();
})();
