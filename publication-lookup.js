(() => {
  const mode = document.querySelector('#pub-lookup-mode');
  const input = document.querySelector('#pub-lookup-query');
  const status = document.querySelector('#pub-lookup-status');
  const results = document.querySelector('#pub-lookup-results');
  const search = document.querySelector('#pub-lookup-search');
  const scan = document.querySelector('#pub-lookup-scan');
  const camera = document.querySelector('#pub-barcode-camera');
  const video = document.querySelector('#pub-barcode-video');
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
        if (!window.NeoCacheISBN.valid(code)) { status.textContent = 'This is not an ISBN. Scan a 978/979 book barcode, or search by title or series.'; return; }
        currentControls.stop();
        stopCamera();
        mode.value = 'isbn';
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
  async function applyRelease(release) {
    request?.abort();
    const pending = new AbortController();
    request = pending;
    const timeout = setTimeout(() => pending.abort(), 25000);
    try {
      if (release.needs_details) {
        status.textContent = 'Loading this edition…';
        const response = await fetch(`${projectUrl}/functions/v1/publication-lookup`, {
          method:'POST', signal:pending.signal,
          headers:{apikey:publicKey, Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json'},
          body:JSON.stringify({mode:'edition',value:release.openlibrary_id})
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Edition could not be loaded.');
        if (!data.editions?.length) throw Error('Edition details are unavailable. Enter this edition manually.');
        release = data.editions[0];
      }
      if (request !== pending) return;
      itemForm.elements.title.value = release.title || '';
      itemForm.elements.year.value = release.year || '';
      for (const key of ['author','format','publisher','isbn','language','edition','series','issue','illustrator','openlibrary_id']) {
        itemForm.elements[`publication_${key}`].value = release[key] || '';
      }
      results.replaceChildren();
      status.textContent = 'Edition inserted. Check the format, language, series and issue, then add photos and condition. Missing fields can be filled in manually.';
      itemForm.elements.publication_author.focus();
    void window.NeoCacheDuplicates?.check();
    } catch(error) {
      if (request === pending) status.textContent = error.name === 'AbortError' ? 'Lookup timed out. Please try again.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (request === pending) request = null;
    }
  }
  async function lookup() {
    stopCamera();
    request?.abort();
    const pending = new AbortController();
    request = pending;
    const value = input.value.trim();
    if (mode.value === 'isbn') void window.NeoCacheDuplicates?.check({publication_isbn: value});
    results.replaceChildren();
    if (!value) { status.textContent = 'Enter an ISBN, title, author, or series and issue.'; search.disabled = false; return; }
    search.disabled = true;
    status.textContent = 'Searching Open Library…';
    const timeout = setTimeout(() => pending.abort(), 25000);
    try {
      if (!session?.access_token) throw Error('Please sign in again.');
      const response = await fetch(`${projectUrl}/functions/v1/publication-lookup`, {
        method:'POST', signal:pending.signal,
        headers:{apikey:publicKey, Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json'},
        body:JSON.stringify({mode:mode.value, value})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(response.status === 404 ? 'Publication lookup has not been deployed yet.' : data.error || data.message || 'Lookup failed. Please sign in again or retry.');
      if (request !== pending) return;
      if (!data.editions?.length) {
        status.textContent = 'No matches. Try the title, author or series and issue, or fill in the edition manually.';
        return;
      }
      status.textContent = `${data.editions.length} of ${data.total} matches. These are suggested editions, not every printing. Check the source before choosing. Selection replaces title and edition fields; photos and condition stay unchanged.`;
      data.editions.forEach(release => {
        const card = document.createElement('article');
        card.append(text('h3', `${release.author} — ${release.title}`));
        card.append(text('p', [release.format, release.date, release.publisher, release.isbn, release.edition].filter(Boolean).join(' · ')));
        const link = text('a','View on Open Library');
        if (/^OL\d+M$/.test(release.openlibrary_id)) link.href = `https://openlibrary.org/books/${release.openlibrary_id}`;
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        const button = text('button','USE THIS EDITION');
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
  document.querySelector('#pub-barcode-stop').addEventListener('click',stopCamera);
  recordKind.addEventListener('change',clearLookup);
  logoutButton.addEventListener('click',clearLookup);
  itemForm.addEventListener('reset',clearLookup);
  window.addEventListener('pagehide',clearLookup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
})();
