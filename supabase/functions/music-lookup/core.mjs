export function buildQuery(mode, input) {
  const value = String(input || '').trim();
  if (!value || value.length > 160) throw new Error('Enter a search value of up to 160 characters.');
  if (mode === 'barcode') {
    const barcode = value.replace(/[\s-]/g, '');
    if (!/^(\d{8}|\d{12,14})$/.test(barcode)) throw new Error('Enter an 8, 12, 13 or 14 digit barcode.');
    return `barcode:${barcode}`;
  }
  const escaped = value.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, '\\$&');
  if (mode === 'catalog') return `catno:"${escaped}"`;
  if (mode === 'title') return `release:"${escaped}"`;
  if (mode === 'artist') return `artist:"${escaped}"`;
  throw new Error('Choose barcode, catalog number, album title or artist.');
}
export function mapRelease(release) {
  const join = values => [...new Set(values.filter(Boolean))].join(' / ');
  const media = release.media || [];
  const formats = join(media.map(m => m.format));
  return {
    musicbrainz_release_id: release.id,
    title: release.title || '',
    artist: (release['artist-credit'] || []).map(a => typeof a === 'string' ? a : (a.name || a.artist?.name || '') + (a.joinphrase || '')).join(''),
    // Vinyl alone does not establish that a release is an LP.
    format: formats === '12" Vinyl' && release['release-group']?.['primary-type'] === 'Album' ? 'LP' : formats,
    label: join((release['label-info'] || []).map(l => l.label?.name)),
    catalog_number: join((release['label-info'] || []).map(l => l['catalog-number'])),
    barcode: /^(\d{8}|\d{12,14})$/.test(release.barcode || '') ? release.barcode : '',
    year: /^\d{4}/.test(release.date || '') ? release.date.slice(0, 4) : '',
    country: release.country || '',
    edition: join([release.disambiguation, release.packaging]),
    date: release.date || ''
  };
}
