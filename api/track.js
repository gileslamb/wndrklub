export const config = { runtime: 'edge' };

const BASE = 'https://pub-62329d1c692e4122ba80031b097b5d1b.r2.dev/';

const TRACKS = {
  'ko-mandi':    { key: 'Ko%20mandi%20main%202.mp3',        file: 'WndrKlub - Ko Mandi.mp3' },
  'luma-luma':   { key: 'luma%20luma%20sha%20Na%20Mi%20v2.mp3', file: 'WndrKlub - Luma Luma.mp3' },
  'zippa-zappa': { key: 'zippa%20zappa%20v5.mp3',           file: 'WndrKlub - Zippa Zappa.mp3' },
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const track = TRACKS[searchParams.get('id')];
  if (!track) return new Response('Not found', { status: 404 });

  const range = req.headers.get('range');
  const upstream = await fetch(BASE + track.key, range ? { headers: { Range: range } } : undefined);
  if (!upstream.ok && upstream.status !== 206) {
    return new Response('Upstream error', { status: 502 });
  }

  const headers = new Headers({
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (searchParams.get('dl')) {
    headers.set('Content-Disposition', `attachment; filename="${track.file}"`);
    headers.set('Cache-Control', 'no-store');
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
