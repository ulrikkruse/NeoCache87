(() => {
  const mode = document.querySelector('#lookup-mode');
  const input = document.querySelector('#lookup-query');
  const status = document.querySelector('#lookup-status');
  const results = document.querySelector('#lookup-results');
  const search = document.querySelector('#lookup-search');
  const scan = document.querySelector('#lookup-scan');
  const camera = document.querySelector('#barcode-camera');
  const video = document.querySelector('#barcode-video');
  let controls, generation = 0, request, scannerLoad;
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };

  function stopCamera() {
    generation++;
    controls?.stop();
    controls = null;
    video.srcObject?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    camera.hidden = true;
    scan.disabled = false;
  }
  function clearLookup() {
    stopCamera();
    request?.abort();
    request = null;
    search.disabled = false;
    results.replaceChildren();
    status.textContent = '';
  }
  function loadScanner() {
    if (window.ZXingBrowser) return Promise.resolve();
    if (!scannerLoad) scannerLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/zxing-browser-0.1.5.min.js';
      script.onload = resolve;
      script.onerror = () => { script.remove(); scannerLoad = null; reject(Error('Scanner could not load. Enter the barcode manually.')); };
      document.head.append(script);
    });
    return scannerLoad;
  }
  scan.addEventListener('click', async () => {
    stopCamera();
    const current = generation;
    scan.disabled = true;
    status.textContent = 'Opening camera…';
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error('Camera requires HTTPS and a supported browser. You can enter the barcode manually.');
      await loadScanner();
      if (current !== generation) return;
      camera.hidden = false;
      const reader = new ZXingBrowser.BrowserMultiFormatOneDReader();
      const active = await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false}, video, (result, error, currentControls) => {
        if (current !== generation) { currentControls?.stop(); return; }
        if (!result) return;
        const code = result.getText();
        if (!/^(\d{8}|\d{12,14})$/.test(code)) return;
        currentControls.stop();
        stopCamera();
        mode.value = 'barcode';
        input.value = code;
        lookup();
      });
      if (current !== generation) { active.stop(); return; }
      controls = active;
      status.textContent = 'Point the camera at the barcode. Keep the entire code in view.';
    } catch (error) {
      if (current !== generation) return;
      stopCamera();
      status.textContent = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access or enter the barcode manually.' : error.message;
    }
  });
  function applyRelease(release) {
    itemForm.elements.title.value = release.title || '';
    itemForm.elements.year.value = release.year || '';
    for (const key of ['artist','format','label','catalog_number','barcode','country','edition','musicbrainz_release_id']) {
      itemForm.elements[`music_${key}`].value = release[key] || '';
    }
    // An identifier from a previously selected edition must not survive replacement.
    itemForm.elements.music_discogs_release_id.value = '';
    itemForm.elements.music_matrix.value = '';
    results.replaceChildren();
    status.textContent = 'Release details inserted. Check the edition, add your photos and condition, then save.';
    itemForm.elements.music_artist.focus();
    void window.NeoCacheDuplicates?.check();
  }
  async function lookup() {
    stopCamera();
    request?.abort();
    const pending = new AbortController();
    request = pending;
    const value = input.value.trim();
    if (mode.value === 'barcode') void window.NeoCacheDuplicates?.check({music_barcode: value});
    results.replaceChildren();
    if (!value) { status.textContent = 'Enter a barcode, catalog number, album title or artist.'; search.disabled = false; return; }
    search.disabled = true;
    status.textContent = 'Searching MusicBrainz…';
    const timeout = setTimeout(() => pending.abort(), 25000);
    try {
      if (!session?.access_token) throw Error('Please sign in again.');
      const response = await fetch(`${projectUrl}/functions/v1/music-lookup`, {
        method:'POST', signal:pending.signal,
        headers:{apikey:publicKey, Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json'},
        body:JSON.stringify({mode:mode.value, value})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(response.status === 404 ? 'Music lookup has not been deployed yet.' : data.error || data.message || 'Lookup failed. Please sign in again or retry.');
      if (request !== pending) return;
      if (!data.releases?.length) {
        status.textContent = 'No matches. Try the catalog number, album title or artist, or fill in the release manually.';
        return;
      }
      status.textContent = `${data.releases.length} of ${data.total} matches. Compare the edition before choosing. Selecting a result replaces the release fields above; your photos and condition stay as entered.`;
      data.releases.forEach(release => {
        const card = document.createElement('article');
        card.append(text('h3', `${release.artist} — ${release.title}`));
        card.append(text('p', [release.format, release.country, release.date, release.label, release.catalog_number, release.edition].filter(Boolean).join(' · ')));
        const link = text('a','View on MusicBrainz');
        if (/^[a-f0-9-]{36}$/i.test(release.musicbrainz_release_id)) link.href = `https://musicbrainz.org/release/${release.musicbrainz_release_id}`;
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        const button = text('button','USE THIS RELEASE');
        button.type = 'button'; button.addEventListener('click',()=>applyRelease(release));
        card.append(link,button); results.append(card);
      });
    } catch (error) {
      if (request !== pending) return;
      status.textContent = error.name === 'AbortError' ? 'Lookup timed out. Please try again.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (request === pending) { search.disabled = false; request = null; }
    }
  }
  search.addEventListener('click',lookup);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookup();}});
  document.querySelector('#barcode-stop').addEventListener('click',stopCamera);
  recordKind.addEventListener('change',clearLookup);
  logoutButton.addEventListener('click',clearLookup);
  itemForm.addEventListener('reset',clearLookup);
  window.addEventListener('pagehide',clearLookup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
})();
