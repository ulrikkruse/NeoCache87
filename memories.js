(() => {
  const {element, pages, itemHref} = NeoTour;
  const status = document.getElementById('memory-status'), list = document.getElementById('memory-list');
  const story = document.getElementById('memory-story'), retry = document.getElementById('memory-retry');
  const params = new URLSearchParams(location.search), urls = new Set();
  let generation = 0;
  async function imageInto(parent, record, version, cover = false) {
    try {
      const url = await NeoMemory.photo(record.path);
      if (version !== generation) { URL.revokeObjectURL(url); return; }
      urls.add(url);
      const image = element('img', ''); image.alt = record.caption || 'Memory photograph'; image.src = url;
      if (!cover) image.loading = 'lazy';
      parent.prepend(image);
    } catch {
      if (version === generation) parent.prepend(element('p', 'Photograph unavailable. Use TRY AGAIN to reload.'));
      if (version === generation) retry.hidden = false;
    }
  }
  async function load() {
    const version = ++generation;
    urls.forEach(url => URL.revokeObjectURL(url)); urls.clear();
    retry.hidden = true; list.replaceChildren(); story.replaceChildren(); story.hidden = true;
    status.textContent = 'Loading memories…';
    const id = params.get('memory'), item = params.get('item');
    document.getElementById('memory-back').hidden = !id && !item;
    try {
      const query = `memories?select=*&published=eq.true&order=created_at.desc,id.asc${id ? '&id=eq.' + encodeURIComponent(id) : item ? '&related_item_id=eq.' + encodeURIComponent(item) : ''}`;
      const rows = await pages(NeoMemory.read, query);
      if (version !== generation) return;
      status.textContent = rows.length ? (item ? 'Memories connected to this object.' : '') : id ? 'This memory is not available.' : item ? 'No published memories are linked to this object yet.' : 'The first memories are still being gathered. Come back soon.';
      for (const row of rows) {
        const photos = await pages(NeoMemory.read, `memory_photos?select=*&memory_id=eq.${encodeURIComponent(row.id)}&order=position.asc,created_at.asc,id.asc`);
        if (version !== generation) return;
        if (id) {
          story.hidden = false; document.title = `${row.title} // Memory Lane`;
          story.append(element('h2', row.title), element('p', [row.period, row.place, row.theme].filter(Boolean).join(' · '), 'memory-meta'), element('p', row.body, 'memory-body'));
          if (row.related_item_id) {
            const items = await NeoMemory.read(`items?select=*,music_details(*),publication_details(*)&id=eq.${encodeURIComponent(row.related_item_id)}`);
            if (version !== generation) return;
            if (items[0]) { const link = element('a', `OPEN DOSSIER: ${items[0].title} →`, 'rooms-link'); link.href = itemHref(items[0]); story.append(link); }
          }
          const album = element('div', '', 'memory-album'); story.append(album);
          for (const photo of photos) { const figure = element('figure', ''); figure.append(element('figcaption', photo.caption)); album.append(figure); void imageInto(figure, photo, version); }
        } else {
          const card = element('article', '', 'memory-card'), link = element('a', row.title);
          link.href = `memories.html?memory=${encodeURIComponent(row.id)}`;
          const heading = element('h2', ''); heading.append(link);
          card.append(heading, element('p', [row.period, row.place, row.theme].filter(Boolean).join(' · '), 'memory-meta'), element('p', row.body.length > 180 ? row.body.slice(0, 180) + '…' : row.body));
          list.append(card); if (photos[0]) void imageInto(card, photos[0], version, true);
        }
      }
    } catch {
      if (version !== generation) return;
      status.textContent = 'Memory Lane could not be loaded. Please try again.'; retry.hidden = false;
    }
  }
  retry.addEventListener('click', load); void load();
})();
