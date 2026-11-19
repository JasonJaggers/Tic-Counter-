'use strict';
const REVISION='3.2.7',CACHE='sterling-specialty-cache-v40';
const FILES=['./','./index.html','./app.css?v='+REVISION,'./report.js?v='+REVISION,'./app.js?v='+REVISION,'./manifest.webmanifest','./sterling-specialty-icon-full.png'];
const STATIC=new Set(['app.css','report.js','app.js','manifest.webmanifest','sterling-specialty-icon-full.png']);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sterling-specialty-cache-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
async function navigation(request){
 const cache=await caches.open(CACHE),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
 try{const response=await fetch(request,{signal:controller.signal});if(response.ok){const text=await response.clone().text();if(text.includes('name="app-version" content="'+REVISION+'"'))await cache.put('./index.html',response.clone());return response;}const saved=await cache.match('./index.html');return saved||response;}
 catch{const saved=await cache.match('./index.html');return saved||new Response('Sterling is offline. Reconnect once to finish setup.',{status:503,headers:{'Content-Type':'text/plain'}});}
 finally{clearTimeout(timer);}
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||request.headers.has('Authorization'))return;
 if(request.mode==='navigate'){event.respondWith(navigation(request));return;}
 const relative=url.pathname.slice(scope.pathname.length);if(!STATIC.has(relative))return;
 // Explicit version keys keep old/new shells from sharing incompatible scripts.
 if(url.search&&url.searchParams.get('v')!==REVISION)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());return response;}));
});
