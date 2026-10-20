const CACHE="alpha-static-v1";
const CORE=["./","./index.html","./styles.css","./app.js","./history.js","./english.js","./sync.js","./firebase-config.js"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>(n.startsWith("alpha-static-"))&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy)).catch(()=>{});return response}).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}
    return response;
  }).catch(()=>caches.match(event.request)));
});
