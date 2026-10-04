// Vercel Edge Function: CORS proxy for Lecture Player downloads
// Put this file at  api/dl.js  in your Vercel project, then redeploy.
export const config = { runtime: 'edge' };

const KEY = '3005temp'; // must match k= in YTPROXY inside index.html
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'range',
  'Access-Control-Expose-Headers': 'content-length, content-type, content-range',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const p = new URL(req.url).searchParams;
  const u = p.get('u');
  if (p.get('k') !== KEY || !u || !/^https?:\/\//i.test(u)) {
    return new Response('Bad request', { status: 400, headers: cors });
  }

  const h = new Headers({ 'user-agent': 'Mozilla/5.0' });
  const range = req.headers.get('range');
  if (range) h.set('range', range);

  const r = await fetch(u, { headers: h, redirect: 'follow' });
  const out = new Headers(r.headers);
  for (const [k, v] of Object.entries(cors)) out.set(k, v);
  return new Response(r.body, { status: r.status, headers: out });
}
