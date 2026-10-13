const C="metavivaseis-v12",FILES=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:"reload"})))).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const q=e.request,u=new URL(q.url);if(q.method!="GET"||u.origin!=location.origin)return;
 const nav=q.mode=="navigate"||/\/(index\.html)?$/.test(u.pathname)||u.pathname.endsWith("sw.js");
 e.respondWith(fetch(nav?new Request(q,{cache:"no-store"}):q).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(q,cp))}return r}).catch(()=>caches.match(q).then(r=>r||caches.match("./index.html"))))});
