// The database owns the total. This token only prevents counting reloads/navigation.
(() => {
  const output = document.getElementById('visitor-count');
  const config = window.NEOCACHE_CONFIG;
  if (!output || !config?.SUPABASE_URL || !config?.SUPABASE_PUBLIC_KEY) return;
  let visitId = null;
  try {
    const key = 'neocache-visit-v1';
    visitId = sessionStorage.getItem(key);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId || '')) {
      visitId = crypto.randomUUID();
      sessionStorage.setItem(key, visitId);
    }
  } catch {
    // With storage disabled, display the total without inflating it on every page.
    visitId = null;
  }
  async function refresh() {
    try {
      const response = await fetch(`${config.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/register_visit`, {
        method: 'POST',
        headers: {apikey: config.SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${config.SUPABASE_PUBLIC_KEY}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({p_visit_id: visitId}),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error('Counter unavailable');
      const total = await response.json();
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid count');
      output.textContent = new Intl.NumberFormat('en-GB').format(total);
    } catch {
      output.textContent = '—';
    }
  }
  void refresh();
  // Also refresh restored/back-forward pages without registering another visit.
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
})();
