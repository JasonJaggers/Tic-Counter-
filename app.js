(()=>{'use strict';
const S=window.Sterling,$=id=>document.getElementById(id);
const K={counts:'tank-counter-v1',levels:'sterling-line1-levels-v1',archives:'sterling-v2-archives',reports:'sterling-v21-reports',draft:'sterling-v21-draft',notes:'sterling-v2-shift-notes',bbs:'sterling-specialty-bbs-selected-v1',report:'sterling-specialty-report-selected-v1'};
let toastTimer,dayTimer,draftTimer,storageBlocked=false;
function notify(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function read(key,fallback){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(e){
 try{const raw=localStorage.getItem(key);if(raw!==null)localStorage.setItem('sterling-recovery-'+Date.now()+'-'+key,raw);}catch{storageBlocked=true;}
 return fallback;
}}
function persist(key,value){try{if(storageBlocked)throw Error('storage blocked');localStorage.setItem(key,JSON.stringify(value));return true;}catch{notify('Could not save on this device. Export a backup before resetting.');return false;}}
const array=(value)=>Array.isArray(value)?value.filter(x=>x&&typeof x==='object'):[];
let data=S.normalizeCounts(read(K.counts,{})),levels=S.normalizeLevels(read(K.levels,{}));
let archives=array(read(K.archives,[])),reports=array(read(K.reports,[]));
let draft=read(K.draft,{});if(!draft||typeof draft!=='object'||Array.isArray(draft))draft={};
let undo=[],activePanel='home',lastPrepared=null,restoring=false;
const localDate=()=>new Date().toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'});
function snapshot(){return {created:localDate(),counts:{...data.counts},hold:data.pounds,amd:data.amd,levels:{...levels}};}
function exportJSON(value,name){download(JSON.stringify(value,null,2),'application/json',name);}
function download(body,type,name){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function paintWidgetPreview(){const holder=$('widget-preview-counts');holder.replaceChildren();for(const name of S.COUNT_NAMES.slice(0,3)){const part=document.createElement('div'),label=document.createElement('small'),value=document.createElement('b');label.textContent=name;value.textContent=data.counts[name];part.append(label,value);holder.append(part);}}
function totals(){
 $('mix-total').textContent=S.COUNT_NAMES.slice(0,3).reduce((n,k)=>n+data.counts[k],0)+' total';
 $('unload-total').textContent=S.COUNT_NAMES.slice(3).reduce((n,k)=>n+data.counts[k],0)+' total';
}
function renderCounters(){for(const name of S.COUNT_NAMES)$('n-'+name.replace(' ','-')).textContent=data.counts[name];totals();paintWidgetPreview();}
for(const [parent,names] of [[$('mix'),S.COUNT_NAMES.slice(0,3)],[$('trucks'),S.COUNT_NAMES.slice(3)]]){
 for(const name of names){const card=document.createElement('article');card.className='counter';
 const label=document.createElement('span');label.className='counter-label';label.textContent=name;
 const count=document.createElement('div');count.className='counter-value';count.id='n-'+name.replace(' ','-');count.textContent=data.counts[name];
 const button=document.createElement('button');button.type='button';button.className='plus';button.textContent='+';button.setAttribute('aria-label','Add one to '+name);
 button.onclick=()=>{if(!Number.isSafeInteger(data.counts[name]+1)){notify('Count is at the maximum supported value.');return;}
 const previous=data.counts[name];data.counts[name]++;if(!persist(K.counts,data)){data.counts[name]=previous;return;}
 undo.push({name,value:previous});if(undo.length>30)undo.shift();renderCounters();};
 card.append(label,count,button);parent.append(card);}
}
for(const key of ['pounds','amd']){const input=$(key);input.value=data[key];input.oninput=()=>{if(!input.validity.valid)return;const previous=data[key];data[key]=input.value;if(!persist(K.counts,data)){data[key]=previous;input.value=previous;}};input.onchange=()=>{if(!input.validity.valid){notify('Check the '+(key==='amd'?'AMD percentage (0–100).':'tank weight (zero or greater).'));input.focus();}};}
for(const name of S.LEVEL_NAMES){const card=document.createElement('div');card.className='level';
 const label=document.createElement('label');label.htmlFor='level-'+name;label.textContent=name;
 const wrap=document.createElement('div');wrap.className='input-unit';const input=document.createElement('input');
 Object.assign(input,{id:'level-'+name,type:'number',inputMode:'decimal',min:'0',max:'99',step:'any',placeholder:'0',value:levels[name]});input.setAttribute('aria-label',name+' level percentage');
 const unit=document.createElement('span');unit.textContent='%';
 input.oninput=()=>{if(!input.validity.valid)return;const previous=levels[name];levels[name]=input.value;if(!persist(K.levels,levels)){levels[name]=previous;input.value=previous;}};
 input.onchange=()=>{if(!input.validity.valid){notify('Tank levels must be from 0 to 99%.');input.focus();}};
 wrap.append(input,unit);card.append(label,wrap);$('level-counters').append(card);
}
$('undo').onclick=()=>{const item=undo[undo.length-1];if(!item){notify('No recent tap to undo.');return;}const current=data.counts[item.name];data.counts[item.name]=item.value;if(!persist(K.counts,data)){data.counts[item.name]=current;return;}undo.pop();renderCounters();notify('Undid '+item.name+'.');};
function archive(){const next=[snapshot(),...archives].slice(0,120);if(!persist(K.archives,next))return false;archives=next;renderHistory();return true;}
$('reset').onclick=()=>{if(!confirm('Reset mix/unload counts, hold pounds and AMD? A snapshot will be saved first.'))return;if(!archive())return;
 const previous=data;data=S.normalizeCounts({pounds:'0',amd:'0'});if(!persist(K.counts,data)){data=previous;return;}
 undo=[];renderCounters();$('pounds').value='0';$('amd').value='0';notify('Counts reset. Previous values are in History.');};
$('reset-levels').onclick=()=>{if(!confirm('Reset all tank levels to zero? A snapshot will be saved first.'))return;if(!archive())return;const previous=levels;
 levels=Object.fromEntries(S.LEVEL_NAMES.map(k=>[k,'0']));if(!persist(K.levels,levels)){levels=previous;return;}for(const k of S.LEVEL_NAMES)$('level-'+k).value='0';notify('Levels reset. Previous values are in History.');};
function validReadings(){for(const id of ['pounds','amd',...S.LEVEL_NAMES.map(n=>'level-'+n)]){if(!$(id).validity.valid){notify('Check the highlighted reading before preparing a report.');$(id).reportValidity();$(id).focus();return false;}}return true;}
async function share(text){if(navigator.share){try{await navigator.share({text});return;}catch(e){if(e.name==='AbortError')return;}}location.href='sms:&body='+encodeURIComponent(text);}
$('share').onclick=()=>{if(!validReadings())return;const lines=S.COUNT_NAMES.filter(n=>data.counts[n]>0).map(n=>n+': '+data.counts[n]);if(data.pounds!==''&&Number(data.pounds)!==0)lines.push('Hold: '+Number(data.pounds).toLocaleString('en-US')+' lb');if(data.amd!==''&&Number(data.amd)!==0)lines.push('AMD: '+data.amd+'%');if(!lines.length){notify('Nothing recorded to share.');return;}share(lines.join('\n'));};
$('share-levels').onclick=()=>{if(!validReadings())return;const lines=S.LEVEL_NAMES.filter(n=>levels[n]!==''&&Number(levels[n])>0).map(n=>n+': '+levels[n]+'%');if(!lines.length){notify('No levels recorded to share.');return;}share(['STERLING SPECIALTY — Levels',localDate(),...lines].join('\n'));};
$('export').onclick=()=>{const rows=[['Timestamp','Mix 1','Mix 2','Mix 3','Pounds','AMD %','AA','NA','AN'],[new Date().toISOString(),...S.COUNT_NAMES.slice(0,3).map(n=>data.counts[n]),data.pounds,data.amd,...S.COUNT_NAMES.slice(3).map(n=>data.counts[n])]];download(rows.map(row=>row.map(S.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8','sterling-counts-'+S.workday()+'.csv');};
$('calculate').onclick=()=>{const input=$('mix-input'),n=Number(input.value);if(input.value.trim()===''||!Number.isFinite(n)||n<0){notify('Enter a pounds value of zero or greater.');input.focus();return;}$('conversion-result').textContent=Math.ceil(n/2.205).toLocaleString('en-US')+' kg';input.blur();};
$('mix-input').onkeydown=e=>{if(e.key==='Enter')$('calculate').click();};
function dailyValue(key){try{return localStorage.getItem(key);}catch{return null;}}
function markDaily(key){try{localStorage.setItem(key,S.workday());paintDaily();}catch{notify('Could not save the daily indicator.');}}
function paintDaily(){const day=S.workday(),bbs=dailyValue(K.bbs)===day,report=dailyValue(K.report)===day;
 $('bbs-request').classList.toggle('done',bbs);$('report-request').classList.toggle('done',report);$('nav-report-dot').classList.toggle('done',report);
 $('bbs-request').setAttribute('aria-label',bbs?'BBS selected for this workday':'Open BBS');$('report-request').setAttribute('aria-label',report?'Report selected for this workday; open ChatGPT':'Give a shift report in ChatGPT');
 $('today').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric'}).format(new Date(day+'T12:00:00Z'))+' · workday';$('shift-label').textContent=S.shift();
 clearTimeout(dayTimer);if(!document.hidden)dayTimer=setTimeout(paintDaily,60000-Date.now()%60000+40);
}
$('bbs-request').addEventListener('click',()=>markDaily(K.bbs));
function refreshSnapshot(){const mixes=S.COUNT_NAMES.slice(0,3).reduce((n,k)=>n+data.counts[k],0),unloads=S.COUNT_NAMES.slice(3).reduce((n,k)=>n+data.counts[k],0);
 const holder=$('report-snapshot');holder.replaceChildren();
 for(const [name,value] of [['Mixes',mixes],['Unloads',unloads],['Hold · lb',data.pounds===''?'—':Number(data.pounds).toLocaleString('en-US')]]){const el=document.createElement('div'),label=document.createElement('small'),number=document.createElement('strong');label.textContent=name;number.textContent=value;el.append(label,number);holder.append(el);}
 $('snapshot-detail').textContent=[...S.COUNT_NAMES.map(k=>k+': '+data.counts[k]),'Hold: '+(data.pounds||'not entered')+' lb','AMD: '+(data.amd||'not entered')+'%',...S.LEVEL_NAMES.map(k=>k+' level: '+(levels[k]===''?'not entered':levels[k]+'%'))].join('\n');
}
function select(panel){activePanel=panel;for(const name of ['home','report','history'])$(name+'-panel').hidden=name!==panel;for(const button of document.querySelectorAll('[data-panel]')){const selected=button.dataset.panel===panel;button.classList.toggle('active',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}if(panel==='report')refreshSnapshot();if(panel==='history')renderHistory();window.scrollTo(0,0);}
$('report-notes').value=typeof draft.notes==='string'?draft.notes:'';
function saveDraft(){if(restoring)return;clearTimeout(draftTimer);draft={...draft,notes:$('report-notes').value};persist(K.draft,draft);}
$('report-notes').oninput=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,180);};
function preparedReport(){if(!validReadings())return null;saveDraft();
 const reference={};for(const field of ['operator','flow','belt','dryer','initiators'])if(typeof draft[field]==='string'&&draft[field])reference[field]=draft[field];
 const source={workday:S.workday(),shift:S.shift(),counters:{...data.counts},hold_lb:data.pounds,amd_percent:data.amd,levels_percent:{...levels},notes:$('report-notes').value.trim(),reference_settings:reference};
 const signature=S.fingerprint(source);let existing=lastPrepared&&reports.find(r=>r.id===lastPrepared.id&&lastPrepared.signature===signature);
 if(!existing){existing=reports.find(r=>r.fingerprint===signature&&r.workday===source.workday&&r.sync_status!=='synced');}
 if(existing){lastPrepared={id:existing.id,signature};return existing;}
 if(reports.length>=500){notify('Report storage is full. Export your history before preparing another.');return null;}
 const record={...source,id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2),created_at:new Date().toISOString(),local_time:localDate(),fingerprint:signature,readings:{},sync_status:'local_only'};
 const next=[record,...reports];if(!persist(K.reports,next))return null;reports=next;lastPrepared={id:record.id,signature};renderHistory();return record;
}
function showPacket(text){$('handoff-fallback').hidden=false;$('handoff-text').value=text;}
async function copyPacket(text){showPacket(text);try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}
function handoff(record,open=true){if(!record)return;const prompt=S.buildPrompt(record);showPacket(prompt);
 if(open&&navigator.onLine){const query='https://chatgpt.com/?q='+encodeURIComponent(prompt);const url=query.length<=14000?query:'https://chatgpt.com/';window.open(url,'_blank','noopener,noreferrer');
 $('handoff-status').textContent='In ChatGPT, dictate your settings and handoff. If the report is not prefilled, paste the copied packet. Sheet saving is confirmed there.';
 copyPacket(prompt).then(ok=>{if(!ok){$('handoff-fallback').open=true;notify('Packet saved below. Copy it if ChatGPT needs the context.');}else notify('Report packet copied. Continue your handoff in ChatGPT.');});
 }else if(open){$('handoff-status').textContent='You are offline. This packet is saved on your device. Reconnect, then continue in ChatGPT.';notify('Saved on device. ChatGPT needs a connection.');}
 else{copyPacket(prompt).then(ok=>{notify(ok?'Report packet copied.':'Select and copy the report packet below.');if(!ok)$('handoff-fallback').open=true;});}
}
function startReport(){select('report');markDaily(K.report);handoff(preparedReport());}
$('report-request').onclick=startReport;$('report-chat').onclick=()=>{markDaily(K.report);handoff(preparedReport());};
for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>button.dataset.panel==='report'?startReport():select(button.dataset.panel);
$('copy-report').onclick=()=>handoff(preparedReport(),false);
$('save-report').onclick=()=>{const r=preparedReport();if(r){$('handoff-status').textContent='Saved on this device. The sheet has not been updated from this app.';notify('Report snapshot saved on this device.');}};
let recognition=null;
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Recognition){$('dictate').querySelector('span').textContent='Use keyboard mic';$('dictate').onclick=()=>{$('report-notes').focus();$('dictation-status').textContent='Use your keyboard microphone, or dictate in ChatGPT.';};}
else $('dictate').onclick=()=>{
 if(recognition){recognition.stop();return;}
 try{const base=$('report-notes').value;let text='';const engine=new Recognition();recognition=engine;engine.lang=navigator.language||'en-US';engine.interimResults=true;engine.continuous=true;
 engine.onstart=()=>{$('dictate').querySelector('span').textContent='Stop dictation';$('dictation-status').textContent='Listening…';};
 engine.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++){if(event.results[i].isFinal)text+=(text?' ':'')+event.results[i][0].transcript;}
 if(text){$('report-notes').value=base+(base?'\n':'')+text;saveDraft();}};
 engine.onerror=()=>{$('dictation-status').textContent='Use your keyboard microphone or type a note. Your text is kept.';};
 engine.onend=()=>{recognition=null;$('dictate').querySelector('span').textContent='Dictate a note';if($('dictation-status').textContent==='Listening…')$('dictation-status').textContent='Note saved on device.';};engine.start();
 }catch{recognition=null;$('report-notes').focus();$('dictation-status').textContent='Use your keyboard microphone or dictate in ChatGPT.';}
};
function historyItem(container,heading,text,actions=[]){const card=document.createElement('article');card.className='history-item';const date=document.createElement('small');date.textContent=heading;const p=document.createElement('p');p.textContent=text;card.append(date,p);for(const [label,click] of actions){const button=document.createElement('button');button.type='button';button.className='text-button';button.textContent=label;button.onclick=click;card.append(button);}container.append(card);}
function renderHistory(){const holder=$('saved-reports'),saved=$('saved-archives');holder.replaceChildren();saved.replaceChildren();$('report-count').textContent=reports.length+' on device';
 if(!reports.length){const p=document.createElement('p');p.className='empty-state';p.textContent='Your prepared reports will appear here.';holder.append(p);}
 for(const r of reports.slice(0,30)){const status=r.sync_status==='synced'?'Previously marked synced':'On device · sheet not confirmed';historyItem(holder,String(r.local_time||r.created_at||'Saved report')+' · '+status,[['Flow',r.readings?.flow_gpm],['Belt',r.readings?.belt_speed],['Dryer',r.readings?.dryer_temperatures],['Initiators',r.readings?.initiators]].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>k+': '+v).join(' · ')+(r.notes?'\n'+r.notes:'\nCounter snapshot ready for a spoken handoff.'),[['Continue report ↗',()=>{select('report');markDaily(K.report);handoff(r);}],['Export',()=>exportJSON(r,'sterling-report-'+String(r.id).slice(0,40)+'.json')]]);}
 if(!archives.length){const p=document.createElement('p');p.className='empty-state';p.textContent='A snapshot is saved before each reset.';saved.append(p);}
 for(const item of archives.slice(0,30))historyItem(saved,String(item.created||'Counter snapshot'),'Mix: '+S.COUNT_NAMES.slice(0,3).map(k=>item.counts?.[k]??0).join(' / ')+'\nUnload: '+S.COUNT_NAMES.slice(3).map(k=>item.counts?.[k]??0).join(' / ')+'\nHold: '+(item.hold??'—')+' lb');
}
$('backup-now').onclick=()=>{if(archive())notify('Counter snapshot saved.');};
function backup(){return {schema:3,exported:new Date().toISOString(),current:{...data,levels:{...levels}},archives,notes:array(read(K.notes,[])),reports,draft,completion:{bbs:dailyValue(K.bbs),report:dailyValue(K.report)}};}
$('backup-export').onclick=()=>exportJSON(backup(),'sterling-backup-'+S.workday()+'.json');
$('backup-import').onchange=async event=>{const file=event.target.files[0];if(!file)return;
 try{if(file.size>4*1024*1024)throw Error('Backup exceeds 4 MB.');const value=JSON.parse(await file.text());
 if(!value||typeof value!=='object'||!Array.isArray(value.archives)||!Array.isArray(value.reports)||value.archives.length>120||value.reports.length>500)throw Error('Choose a Sterling JSON backup.');
 if(value.reports.some(r=>!r||typeof r!=='object'||typeof r.id!=='string'||r.id.length>150))throw Error('Invalid report records in backup.');
 if(!confirm('Replace local history with this backup? Export your current history first if you need both.'))return;
 const entries=[[K.archives,value.archives],[K.reports,value.reports]];
 if(value.current&&(!value.current.counts||typeof value.current.counts!=='object'||Array.isArray(value.current.counts)))throw Error('Invalid counter snapshot in backup.');
 if(value.notes&&Array.isArray(value.notes)&&value.notes.length<=500)entries.push([K.notes,value.notes]);
 if(value.current){entries.push([K.counts,S.normalizeCounts(value.current)],[K.levels,S.normalizeLevels(value.current.levels)]);}
 if(value.draft&&typeof value.draft==='object'&&!Array.isArray(value.draft))entries.push([K.draft,value.draft]);
 const previous=entries.map(([key])=>[key,localStorage.getItem(key)]);
 try{for(const [key,val] of entries)localStorage.setItem(key,JSON.stringify(val));}catch(e){for(const [key,val] of previous){try{if(val===null)localStorage.removeItem(key);else localStorage.setItem(key,val);}catch{}}throw Error('Storage unavailable. Backup was not fully restored.');}
 clearTimeout(draftTimer);restoring=true;location.reload();
 }catch(e){notify(e.message||'Could not restore this backup.');}finally{event.target.value='';}
};
$('copy-widget-script').onclick=async()=>{
 const button=$('copy-widget-script');button.disabled=true;
 try{const response=await fetch('./ios/Sterling-Counters.js?v=3.2.0');if(!response.ok)throw Error('Could not load the widget script. Reconnect and retry.');const source=await response.text();if(source.length>32000||!source.includes('Sterling Mix'))throw Error('Widget script unavailable.');
  $('widget-script-text').value=source;$('widget-script-fallback').hidden=false;
  try{await navigator.clipboard.writeText(source);$('widget-status').textContent='Script copied. In Scriptable, create a script, paste it, and name it Sterling Mix.';notify('Widget script copied.');}
  catch{$('widget-script-fallback').open=true;$('widget-script-text').focus();$('widget-script-text').select();$('widget-status').textContent='Select and copy the script below, then paste it into a new Scriptable script named Sterling Mix.';}
 }catch(e){$('widget-status').textContent=e.message;}finally{button.disabled=false;}
};
for(const link of document.querySelectorAll('[data-widget-update]'))link.addEventListener('click',event=>{
 try{link.href=S.widgetURLAll(data.counts);$('widget-status').textContent='Opening Scriptable with the current mix counts. Check its preview; the Home Screen widget refreshes on the iOS schedule.';}
 catch{event.preventDefault();notify('Could not prepare the mix snapshot.');}
});
if(location.hash==='#widget-setup'){$('widget-setup').open=true;requestAnimationFrame(()=>$('widget-setup').scrollIntoView({block:'start'}));}
$('calendar-details').addEventListener('toggle',()=>{if(!$('calendar-details').open||$('calendar-holder').childElementCount||!navigator.onLine)return;
 const iframe=document.createElement('iframe');iframe.title='Google Calendar agenda';iframe.loading='lazy';iframe.referrerPolicy='no-referrer';iframe.src='https://calendar.google.com/calendar/embed?mode=AGENDA&showTitle=0&showCalendars=0&showPrint=0&showTabs=0&ctz=America%2FChicago&src=jasonjaggers%40gmail.com';$('calendar-holder').append(iframe);
});
function connectivity(){const online=navigator.onLine;$('connection').textContent=online?'Online':'Offline';$('connection').classList.toggle('offline',!online);if(!online)$('handoff-status').textContent='Offline · counters, notes and saved reports still work on this device.';}
window.addEventListener('online',()=>{connectivity();notify('Connection restored. Your saved report is ready.');});window.addEventListener('offline',connectivity);
window.addEventListener('storage',event=>{if(event.key===K.counts){data=S.normalizeCounts(read(K.counts,{}));undo=[];renderCounters();$('pounds').value=data.pounds;$('amd').value=data.amd;}
 if(event.key===K.levels){levels=S.normalizeLevels(read(K.levels,{}));for(const n of S.LEVEL_NAMES)$('level-'+n).value=levels[n];}
 if(event.key===K.reports)reports=array(read(K.reports,[]));if(event.key===K.archives)archives=array(read(K.archives,[]));paintDaily();if(activePanel==='report')refreshSnapshot();if(activePanel==='history')renderHistory();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveDraft();clearTimeout(dayTimer);recognition?.stop();}else{paintDaily();connectivity();}});window.addEventListener('focus',paintDaily);window.addEventListener('pageshow',paintDaily);window.addEventListener('pagehide',saveDraft);
let registration=null;
$('update-app').onclick=()=>{saveDraft();location.reload();};
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
 const controlled=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&controlled)$('update-app').hidden=false;});});if(reg.waiting)$('update-app').hidden=false;}).catch(()=>notify('Offline setup could not finish. Your saved data is kept.'));
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)$('update-app').hidden=false;});
 window.addEventListener('online',()=>registration?.update().catch(()=>{}));
}
// Widget actions are applied only inside the browser storage that opened this URL.
// Repeated URLs are ignored using a short event ledger held alongside the counts.
function applyWidgetAction(){
 const url=new URL(location.href),name=url.searchParams.get('widget_counter'),id=url.searchParams.get('widget_event');
 if(!name&&!id)return;
 url.searchParams.delete('widget_counter');url.searchParams.delete('widget_event');
 try{history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{}
 if(!S.COUNT_NAMES.includes(name)||!id||!/^[a-z0-9-]{8,72}$/i.test(id)){notify('Invalid widget action. No counts changed.');return;}
 const original=read(K.counts,{}),events=Array.isArray(original.widgetEvents)?original.widgetEvents.filter(x=>typeof x==='string').slice(-40):[];
 if(events.includes(id)){notify('Widget tap already recorded.');return;}
 const next=data.counts[name]+1;
 if(!Number.isSafeInteger(next)){notify('Counter limit reached.');return;}
 const before=data.counts[name];data.counts[name]=next;
 if(!persist(K.counts,{...data,widgetEvents:[...events,id].slice(-40)})){data.counts[name]=before;return;}
 undo.push({name,value:before});if(undo.length>30)undo.shift();
 notify(name+' recorded · '+next);
}
applyWidgetAction();
renderCounters();refreshSnapshot();renderHistory();paintDaily();connectivity();
if(storageBlocked)notify('Device storage is unavailable. Export a backup before resetting.');
})();
