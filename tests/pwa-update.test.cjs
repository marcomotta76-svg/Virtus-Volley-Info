"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const sw=fs.readFileSync("sw.js","utf8");
const app=fs.readFileSync("app.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const SCOPE="https://example.test/Virtus-Volley-Info/";

function createWorker(){
 const listeners=new Map();
 const tables=new Map();
 let offline=false,requests=0;
 class Cache {
   constructor(){this.map=new Map()}
   async put(key,response){this.map.set(key instanceof Request?key.url:String(key),response.clone())}
   async match(key,opts={}){
     const target=key instanceof Request?key.url:String(key);
     if(this.map.has(target))return this.map.get(target).clone();
     if(opts.ignoreSearch){
       const canonical=target.split("?")[0];
       for(const [k,v] of this.map)if(k.split("?")[0]===canonical)return v.clone();
     }
     return undefined;
   }
   keys(){return [...this.map.keys()]}
 }
 const sandbox={
   self:{registration:{scope:SCOPE},location:new URL(SCOPE),
      clients:{claim:async()=>{}},skipWaiting:async()=>{},
      addEventListener(name,handler){listeners.set(name,handler)}},
   caches:{
     async open(name){if(!tables.has(name))tables.set(name,new Cache());return tables.get(name)},
     async keys(){return [...tables.keys()]},
     async delete(name){return tables.delete(name)}
   },
   fetch:async(input,options={})=>{
     requests++;
     if(offline)throw Error("offline");
     return new Response("response-"+requests,{status:200,headers:{"content-type":"text/plain"}});
   },
   URL,Request,Response,Promise
 };
 vm.runInNewContext(sw,sandbox,{filename:"sw.js"});
 const lifecycle=async eventName=>{
   let done;listeners.get(eventName)({waitUntil(p){done=p}});
   await done;
 };
 const serve=async(address,mode="same-origin")=>{
   const request=new Request(address,{method:"GET",mode});
   let response;
   listeners.get("fetch")({request,respondWith(p){response=p}});
   if(!response)throw Error("The service worker did not handle "+address);
   return response;
 };
 return {lifecycle,serve,tables,offline(value){offline=value},requests(){return requests}};
}
test("Versione JS e CSS esplicita: asset mobile v11",()=>{
 assert.match(html,/style\.css\?v=11/);
 assert.match(html,/app\.js\?v=11/);
 assert.match(html,/week\.js\?v=11/);
 assert.match(sw,/virtus-volley-info-update-v11/);
});
test("Aggiornamento PWA: controlla la rete prima della cache per JS e HTML",async()=>{
 const worker=createWorker();
 await worker.lifecycle("install");
 const first=(await worker.serve(SCOPE+"app.js?v=11")).clone();
 const firstText=await first.text();
 const secondText=await (await worker.serve(SCOPE+"app.js?v=11")).text();
 assert.notEqual(firstText,secondText,"App JS non deve rimanere bloccato in cache");
 const html1=await (await worker.serve(SCOPE+"index.html")).text();
 const html2=await (await worker.serve(SCOPE+"index.html")).text();
 assert.notEqual(html1,html2,"Home deve usare network-first");
});
test("Offline: mantiene asset installati e archivio dati senza consumare cache illimitata",async()=>{
 const worker=createWorker();
 await worker.lifecycle("install");
 await worker.serve(SCOPE+"data.json?nocache=111");
 await worker.serve(SCOPE+"data.json?nocache=222");
 const cache=worker.tables.get("virtus-volley-info-update-v11");
 assert.equal(cache.keys().filter(k=>k.includes("/data.json")).length,1,"Solo una cache canonica per i dati");
 worker.offline(true);
 const js=await worker.serve(SCOPE+"app.js?v=11");
 assert.ok((await js.text()).startsWith("response-"),"JS recuperato offline da precache");
 const data=await worker.serve(SCOPE+"data.json?nocache=333");
 assert.ok((await data.text()).startsWith("response-"),"Dati FIPAV recuperati offline");
});
test("Nuovo Service Worker prende il controllo e rimuove soltanto cache PWA precedenti",async()=>{
 const worker=createWorker();
 worker.tables.set("virtus-volley-info-today-v10",{});
 worker.tables.set("altra-app",{});
 await worker.lifecycle("install");
 await worker.lifecycle("activate");
 assert.equal(worker.tables.has("virtus-volley-info-today-v10"),false);
 assert.equal(worker.tables.has("altra-app"),true);
});
test("La pagina rileva cambio Service Worker e forza un solo reload",()=>{
 assert.match(app,/addEventListener\("controllerchange"/);
 assert.match(app,/if\(reloaded\)return;/);
 assert.match(app,/window\.location\.reload\(\)/);
 assert.match(app,/updateViaCache:"none"/);
 assert.match(app,/document\.addEventListener\("visibilitychange",check\)/);
});
