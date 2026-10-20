// Vercel Edge Function: streaming proxy for Lecture Player (playback + downloads)
// - forwards Range (seek works), sets a browser-like UA and the target's own Referer
// - rewrites .m3u8 playlists so every segment / key also goes through this proxy
export const config = { runtime: 'edge' };

const KEY = '3005temp'; // must match k= in PX() inside index.html
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'range, content-type',
  'Access-Control-Expose-Headers': 'content-length, content-type, content-range, accept-ranges',
};
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', mp3: 'audio/mpeg', m4a: 'audio/mp4' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const self = new URL(req.url);
  const p = self.searchParams;
  const u = p.get('u');
  if (p.get('k') !== KEY || !u || !/^https?:\/\//i.test(u)) return new Response('Bad request', { status: 400, headers: cors });
  let target;
  try { target = new URL(u); } catch { return new Response('Bad url', { status: 400, headers: cors }); }

  const rf = p.get('r');
  const h = new Headers({ 'user-agent': UA, accept: '*/*', referer: rf && /^https?:\/\//i.test(rf) ? rf : target.origin + '/' });
  const range = req.headers.get('range');
  if (range) h.set('range', range);

  let r;
  try {
    r = await fetch(target.href, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers: h, redirect: 'follow', signal: req.signal });
  } catch (e) {
    return new Response('Upstream fetch failed', { status: 502, headers: cors });
  }

  const ct = r.headers.get('content-type') || '';
  const out = new Headers(r.headers);
  for (const [k, v] of Object.entries(cors)) out.set(k, v);
  out.delete('content-disposition');          // never force a download
  out.delete('content-security-policy');
  if (out.has('content-encoding')) { out.delete('content-encoding'); out.delete('content-length'); }

  const path = target.pathname.toLowerCase();
  const isM3u8 = /mpegurl/i.test(ct) || /\.m3u8?$/.test(path);
  if (r.ok && isM3u8 && req.method !== 'HEAD') {
    const txt = await r.text();
    if (/^\s*#EXTM3U/.test(txt)) {
      const base = r.url || target.href;
      const px = (x) => self.origin + self.pathname + '?k=' + KEY + '&u=' + encodeURIComponent(new URL(x, base).href) + (rf ? '&r=' + encodeURIComponent(rf) : '');
      const body = txt.split(/\r?\n/).map((l) => {
        if (!l.trim()) return l;
        if (l.startsWith('#')) return l.replace(/URI="([^"]+)"/g, (m, x) => 'URI="' + px(x) + '"');
        return px(l.trim());
      }).join('\n');
      out.set('content-type', 'application/vnd.apple.mpegurl');
      out.set('cache-control', 'no-store');
      out.delete('content-length');
      return new Response(body, { status: 200, headers: out });
    }
    out.delete('content-length');
    return new Response(txt, { status: r.status, headers: out });
  }

  const ext = (path.match(/\.([a-z0-9]+)$/) || [])[1];
  if (TYPES[ext] && !/^(video|audio)\//i.test(ct)) out.set('content-type', TYPES[ext]);
  return new Response(req.method === 'HEAD' ? null : r.body, { status: r.status, headers: out });
}
