const C='lp-v6',A=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
/* never touch video/proxy/range traffic: caching big streams made playback slow and broke replays */
if(r.method!=='GET'||u.origin!==location.origin||u.pathname.includes('/api/')||r.headers.has('range')||r.destination==='video'||r.destination==='audio')return;
e.respondWith(fetch(r).then(res=>{if(res.status===200){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{})}return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))))});
