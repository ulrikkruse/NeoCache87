(() => {
  const config = globalThis.NEOCACHE_CONFIG || {};
  const base = (config.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
  const key = config.SUPABASE_PUBLIC_KEY || config.SUPABASE_ANON_KEY;
  async function request(path, options = {}, token = key) {
    const response = await fetch(`${base}/${path}`, {cache: 'no-store', ...options, headers: {apikey: key, Authorization: `Bearer ${token}`, ...options.headers}});
    if (!response.ok) throw Error(`Memory Lane request failed (${response.status}).`);
    return response;
  }
  async function read(query) {
    return (await request(`rest/v1/${query}`)).json();
  }
  // Authenticated downloads apply Storage RLS on every request; no public bucket URLs.
  async function photo(path, token) {
    if (!/^[a-f0-9-]+\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(path)) throw Error('Invalid memory photo path');
    const response = await request(`storage/v1/object/memories/${path}`, {}, token);
    return URL.createObjectURL(await response.blob());
  }
  globalThis.NeoMemory = {read, request, photo};
})();
