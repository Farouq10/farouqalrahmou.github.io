const CACHE="alpha-static-v3";
const CORE=["./","./index.html","./styles.css","./app.js","./history.js","./english.js","./sync.js","./firebase-config.js","./account-state.mjs","./daily.mjs","./content-views.mjs","./problem-bank.js","./articles.js","./enrichment.js","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>(n.startsWith("alpha-static-"))&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  // Cache only the public app shell. Account/resource responses never enter this cache.
  const allowed=new Set(CORE.map(path=>new URL(path,self.location.href).pathname));
  if(!allowed.has(new URL(event.request.url).pathname))return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy)).catch(()=>{});return response}).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}
    return response;
  }).catch(()=>caches.match(event.request)));
});
