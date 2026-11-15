/* Local QA: Chromium + Debian's ws package. Never submits a report to ChatGPT/Sheets. */
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process'),WS=require('ws');
const origin=process.env.STERLING_TEST_ORIGIN||'http://127.0.0.1:8775/';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sterling-qa-profile-'));
const browser=spawn(process.env.CHROMIUM_PATH||'chromium',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9336','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket,id=0;const pending=new Map(),errors=[],checks=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(Error('CDP timeout: '+method));}},15000).unref();});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||'Page evaluation failed');return result.result.value;}
async function until(expression){for(let n=0;n<100;n++){if(await evaluate(expression))return;await pause(100);}throw Error('Condition timed out: '+expression);}
function ok(value,name){assert.ok(value,name);checks.push(name);}
async function screenshot(name){await evaluate("document.getElementById('toast').classList.remove('show');true");const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync('/tmp/sterling-qa/'+name+'.png',Buffer.from(result.data,'base64'));}
(async()=>{let tabs;for(let n=0;n<50;n++){try{tabs=await(await fetch('http://127.0.0.1:9336/json')).json();break;}catch{await pause(100);}}assert.ok(tabs?.length,'Chromium did not launch');socket=new WS(tabs[0].webSocketDebuggerUrl);await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
window.open=url=>{window.__opened=url;return null;};window.confirm=()=>true;
window.SpeechRecognition=class {constructor(){window.__recognition=this;}start(){this.onstart?.();}stop(){this.onend?.();}};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});
if(!localStorage.getItem('qa-seeded')){localStorage.setItem('qa-seeded','1');localStorage.setItem('tank-counter-v1',JSON.stringify({counts:{'Mix 1':4,'Mix 2':2,'Mix 3':1,AA:1,NA:0,AN:2},pounds:'10000',amd:'50'}));localStorage.setItem('sterling-line1-levels-v1',JSON.stringify({AMD:'50',AA:'25',NA:'0',AN:'80'}));localStorage.setItem('sterling-v21-draft',JSON.stringify({flow:'12',belt:'30',notes:''}));localStorage.setItem('sterling-v21-reports',JSON.stringify([{id:'legacy-1',created_at:'2026-11-14T12:00:00Z',local_time:'Nov 14',notes:'Legacy report',readings:{flow_gpm:'11'},sync_status:'local_only'}]));localStorage.setItem('sterling-v2-archives',JSON.stringify([{created:'Nov 14',counts:{'Mix 1':3},hold:'100'}]));}
`});
await send('Page.navigate',{url:origin});await until("document.querySelectorAll('#mix .plus').length===3 && window.Sterling");
ok(await evaluate("document.getElementById('n-Mix-1').textContent==='4' && document.getElementById('level-NA').value==='0'"),'legacy counts/levels preserved');
await evaluate("document.getElementById('widget-setup').open=true;document.getElementById('copy-widget-script').click();true");
await until("!!window.__copied");ok(await evaluate("window.__copied.includes('FileManager.local()')"),'widget script copies from app');
await evaluate("document.getElementById('update-widget').addEventListener('click',e=>e.preventDefault());document.getElementById('update-widget').click();true");
ok(await evaluate("JSON.parse(new URL(document.getElementById('update-widget').href).searchParams.get('snapshot')).mixes['Mix 1']===4"),'widget link transfers current mix counts');
await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await screenshot('widget-375');
ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'widget setup fits phone width');
await evaluate("document.getElementById('widget-setup').open=false;true");
await evaluate("document.querySelector('#mix .plus').click();true");ok(await evaluate("document.getElementById('n-Mix-1').textContent==='5' && JSON.parse(localStorage.getItem('tank-counter-v1')).counts['Mix 1']===5"),'counter increment persisted');
await evaluate("document.getElementById('undo').click();true");ok(await evaluate("document.getElementById('n-Mix-1').textContent==='4'"),'undo preserved');
await evaluate("document.getElementById('mix-input').value='2205';document.getElementById('calculate').click();true");ok(await evaluate("document.getElementById('conversion-result').textContent==='1,000 kg' && document.getElementById('mix-input').value==='2205'"),'conversion does not convert its result twice');
await evaluate("document.getElementById('bbs-request').addEventListener('click',e=>e.preventDefault());window.__bbsColor=getComputedStyle(document.getElementById('bbs-request')).backgroundColor;document.getElementById('bbs-request').click();true");ok(await evaluate("document.getElementById('bbs-request').classList.contains('done') && getComputedStyle(document.querySelector('#bbs-request .daily-dot')).display!=='none' && getComputedStyle(document.getElementById('bbs-request')).backgroundColor===window.__bbsColor"),'BBS uses a daily dot, unchanged button color');
await evaluate("document.getElementById('report-request').click();true");await until("!!window.__opened");
ok(await evaluate("window.__opened.startsWith('https://chatgpt.com/?q=') && !document.getElementById('report-panel').hidden && document.getElementById('report-request').classList.contains('done')"),'Report opens complete ChatGPT handoff and sets dot');
ok(await evaluate("!document.querySelector('#report-panel input') && document.getElementById('handoff-text').value.includes('A2:A1000') && document.getElementById('handoff-text').value.includes('wait for my next dictated message')"),'voice-first report requires no settings form');
const firstId=await evaluate("JSON.parse(localStorage.getItem('sterling-v21-reports'))[0].id");
await evaluate("document.getElementById('report-chat').click();true");ok(await evaluate("JSON.parse(localStorage.getItem('sterling-v21-reports')).length===2"),'repeated unchanged handoff reuses record ID');
ok(await evaluate("JSON.parse(localStorage.getItem('sterling-v21-reports')).every(r=>r.sync_status!=='synced')"),'handoff never claims sheet saved');
await evaluate("document.getElementById('dictate').click();window.__recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'ignored interim'}],{isFinal:false})]});true");
ok(await evaluate("document.getElementById('report-notes').value===''"),'interim dictation not duplicated into saved notes');
await evaluate("window.__recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'Flow eleven, belt thirty, TBHP five sixty, SS five fifty.'}],{isFinal:true})]});window.__recognition.stop();document.getElementById('report-chat').click();true");
ok(await evaluate("JSON.parse(localStorage.getItem('sterling-v21-draft')).notes.includes('Flow eleven') && document.getElementById('handoff-text').value.includes('TBHP five sixty')"),'plain spoken transcript persists and enters report packet');
await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await screenshot('report-375');
await evaluate("document.querySelector('[data-panel=history]').click();true");ok(await evaluate("document.getElementById('saved-reports').textContent.includes('Legacy report') && document.getElementById('saved-archives').textContent.includes('Nov 14')"),'legacy reports and archives preserved');await screenshot('history-375');
await evaluate("document.querySelector('[data-panel=home]').click();true");
for(const width of [320,375,390,768,1280]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});await pause(80);ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'no horizontal overflow at '+width);if(width===375||width===1280)await screenshot('home-'+width);}
await evaluate("window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sterling-v2-archives')throw new DOMException('quota','QuotaExceededError');return window.__setItem.call(this,key,value);};document.getElementById('reset').click();Storage.prototype.setItem=window.__setItem;true");ok(await evaluate("document.getElementById('n-Mix-1').textContent==='4'"),'reset blocked when pre-reset backup cannot save');
await evaluate("window.__previousWeight=document.getElementById('pounds').value;Storage.prototype.setItem=function(key,value){if(key==='tank-counter-v1')throw new DOMException('quota','QuotaExceededError');return window.__setItem.call(this,key,value);};document.getElementById('pounds').value='999';document.getElementById('pounds').dispatchEvent(new Event('input'));Storage.prototype.setItem=window.__setItem;true");
ok(await evaluate("document.getElementById('pounds').value===window.__previousWeight"),'unsaved reading is reverted instead of silently entering a report');
await evaluate("localStorage.setItem('sterling-specialty-bbs-selected-v1','1900-01-01');window.dispatchEvent(new Event('focus'));true");ok(await evaluate("!document.getElementById('bbs-request').classList.contains('done')"),'old workday completion clears');
await until("!!navigator.serviceWorker.controller");await evaluate("navigator.serviceWorker.ready.then(()=>true)");
await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Page.reload');await until("document.getElementById('n-Mix-1')?.textContent==='4'");
ok(await evaluate("document.getElementById('connection').textContent==='Offline'"),'offline cached app boots with existing data');
await evaluate("document.querySelector('#mix .plus').click();document.getElementById('report-request').click();true");
ok(await evaluate("document.getElementById('n-Mix-1').textContent==='5' && !window.__opened && document.getElementById('handoff-status').textContent.includes('offline')"),'offline counters work and report remains local');
await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
const restore={schema:3,current:{counts:{'Mix 1':8,'Mix 2':0,'Mix 3':0,AA:0,NA:0,AN:0},pounds:'0',amd:'0',levels:{AMD:'15',AA:'0',NA:'0',AN:'0'}},reports:[{id:'restored-fixture',notes:'Restored report',readings:{}}],archives:[],draft:{notes:'Restored note'}};
fs.writeFileSync('/tmp/sterling-qa/restore.json',JSON.stringify(restore));
const document=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#backup-import'});
await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:['/tmp/sterling-qa/restore.json']});
await until("document.getElementById('n-Mix-1')?.textContent==='8'");
ok(await evaluate("document.getElementById('level-AMD').value==='15' && document.getElementById('report-notes').value==='Restored note'"),'JSON backup restore recovers counters, levels and notes');
ok(errors.length===0,'no browser runtime exceptions');
fs.writeFileSync('/tmp/sterling-qa/browser-results.json',JSON.stringify({checks,firstRecordId:firstId,errors},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{socket?.close();browser.kill('SIGTERM');setTimeout(()=>fs.rmSync(profile,{recursive:true,force:true}),700);});
