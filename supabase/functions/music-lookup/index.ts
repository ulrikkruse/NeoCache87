import { buildQuery, mapRelease } from './core.mjs';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers: {...cors, 'Content-Type': 'application/json'}});
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (req.method !== 'POST') return reply({error: 'Use POST.'}, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply({error: 'Please sign in again.'}, 401);
    const userHeaders = {apikey: anon, Authorization: authorization, 'Content-Type': 'application/json'};
    const user = await fetch(`${url}/auth/v1/user`, {headers: userHeaders});
    if (!user.ok) return reply({error: 'Please sign in again.'}, 401);
    const admin = await fetch(`${url}/rest/v1/rpc/is_neocache_admin`, {method: 'POST', headers: userHeaders, body: '{}'});
    if (!admin.ok || await admin.json() !== true) return reply({error: 'Admin access required.'}, 403);
    let query: string;
    try {
      const body = await req.json();
      query = buildQuery(body.mode, body.value);
    } catch (error) { return reply({error: error instanceof Error ? error.message : 'Invalid search.'}, 400); }
    const headers = {apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json'};
    const cacheQuery = new URLSearchParams({select:'payload', query:`eq.${query}`, expires_at:`gt.${new Date().toISOString()}`});
    const cached = await fetch(`${url}/rest/v1/music_lookup_cache?${cacheQuery}`, {headers});
    if (!cached.ok) return reply({error: 'Music lookup setup is missing. Apply supabase-music-lookup-setup.sql.'}, 503);
    const rows = await cached.json();
    if (rows.length) return reply(rows[0].payload);
    const slot = await fetch(`${url}/rest/v1/rpc/claim_music_lookup`, {method:'POST', headers, body:'{}'});
    if (!slot.ok) return reply({error:'Music lookup setup is incomplete.'}, 503);
    if (await slot.json() !== true) return reply({error:'Please wait a moment, then search again.'}, 429);
    const contact = Deno.env.get('MUSICBRAINZ_CONTACT');
    if (!contact) return reply({error:'Set MUSICBRAINZ_CONTACT for the lookup function.'}, 503);
    const params = new URLSearchParams({query, fmt:'json', limit:'25'});
    const result = await fetch(`https://musicbrainz.org/ws/2/release/?${params}`, {
      headers: {'User-Agent': `NeoCache/1.0 (${contact})`, Accept:'application/json'}, signal: AbortSignal.timeout(15000)
    });
    if (!result.ok) return reply({error:'MusicBrainz is temporarily unavailable. Please try again later.'}, 502);
    const data = await result.json();
    const payload = {releases: (data.releases || []).map(mapRelease), total: data.count || 0};
    await fetch(`${url}/rest/v1/music_lookup_cache?on_conflict=query`, {method:'POST', headers:{...headers, Prefer:'resolution=merge-duplicates,return=minimal'}, body:JSON.stringify({query, payload, expires_at:new Date(Date.now()+86400000).toISOString()})});
    return reply(payload);
  } catch { return reply({error:'Lookup could not complete. Please try again.'}, 502); }
});
