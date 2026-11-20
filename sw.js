/* Virtus Volley Info PWA v13.
   HTML, CSS e JavaScript: network-first; offline: ultima copia valida.
   Dati FIPAV: network-first, cache canonica singola senza query di refresh.
   Icone e stemmi: cache-first con fallback rete.
   Limitiamo l'eliminazione alle cache di questa PWA. */
const CACHE_NAME="virtus-volley-info-academy-v13";
const CACHE_PREFIX="virtus-volley-info-";
const SHELL=["./","./index.html","./style.css","./app.js","./week.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./logos/virtus_caserta_hq.webp"];
const DATA_URL=new URL("./data.json",self.registration.scope).toString();
const INDEX_URL=new URL("./index.html",self.registration.scope).toString();

self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE_NAME);
   await Promise.all(SHELL.map(async path=>{
     const url=new URL(path,self.registration.scope).toString();
     const response=await fetch(url,{cache:"no-store"});
     if(!response.ok)throw Error("Precache fallita: "+path+" HTTP "+response.status);
     await cache.put(url,response);
   }));
   await self.skipWaiting();
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
   const names=await caches.keys();
   await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
   await self.clients.claim();
 })());
});
async function networkFirst(request,{isData=false,isNavigation=false}={}){
 const cache=await caches.open(CACHE_NAME);
 const key=isData?DATA_URL:request;
 try{
   const response=await fetch(request,{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   await cache.put(key,response.clone());
   return response;
 }catch{
   const cached=await cache.match(key)||await cache.match(key,{ignoreSearch:!isData});
   if(cached)return cached;
   if(isNavigation){
     const fallback=await cache.match(INDEX_URL);
     if(fallback)return fallback;
   }
   return Response.error();
 }
}
async function cacheFirst(request){
 const cache=await caches.open(CACHE_NAME);
 const cached=await cache.match(request);
 if(cached)return cached;
 try{
   const response=await fetch(request);
   if(response.ok)await cache.put(request,response.clone());
   return response;
 }catch{
   return Response.error();
 }
}
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 const isData=url.pathname.endsWith("/data.json");
 const isNavigation=request.mode==="navigate";
 const isShell=/\.(?:html|js|css|webmanifest)$/.test(url.pathname)||url.pathname.endsWith("/");
 // Una query ?v=11 non deve mai far riusare un JS/CSS obsoleto in rete.
 if(isData||isNavigation||isShell)event.respondWith(networkFirst(request,{isData,isNavigation}));
 else event.respondWith(cacheFirst(request));
});
