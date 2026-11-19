(()=>{'use strict';
const S=window.Sterling,$=id=>document.getElementById(id);
const K={counts:'tank-counter-v1',levels:'sterling-line1-levels-v1',archives:'sterling-v2-archives',bbs:'sterling-specialty-bbs-selected-v1',report:'sterling-specialty-report-selected-v1'};
let toastTimer,dayTimer,storageBlocked=false;
function notify(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function read(key,fallback){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(e){
 try{const raw=localStorage.getItem(key);if(raw!==null)localStorage.setItem('sterling-recovery-'+Date.now()+'-'+key,raw);}catch{storageBlocked=true;}
 return fallback;
}}
function persist(key,value){try{if(storageBlocked)throw Error('storage blocked');localStorage.setItem(key,JSON.stringify(value));return true;}catch{notify('Could not save on this device. Check available storage before resetting.');return false;}}
const array=(value)=>Array.isArray(value)?value.filter(x=>x&&typeof x==='object'):[];
let data=S.normalizeCounts(read(K.counts,{})),levels=S.normalizeLevels(read(K.levels,{}));
let archives=array(read(K.archives,[]));
let undo=[];
const menu=$('app-menu'),menuToggle=$('menu-toggle');
function setMenu(open){
 menu.hidden=!open;
 menuToggle.setAttribute('aria-expanded',String(open));
}
menuToggle.addEventListener('click',()=>{
 const open=menu.hidden;
 if(open&&document.activeElement.matches('input,textarea'))document.activeElement.blur();
 setMenu(open);
});
menu.addEventListener('click',event=>{
 if(!event.target.closest('a,button'))return;
 setMenu(false);
 if(!$('report-panel').open)menuToggle.focus();
});
document.addEventListener('pointerdown',event=>{
 if(!menu.contains(event.target)&&!menuToggle.contains(event.target))setMenu(false);
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||menu.hidden)return;
 setMenu(false);
 menuToggle.focus();
});
const localDate=()=>new Date().toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'});
function snapshot(){return {created:localDate(),counts:{...data.counts},hold:data.pounds,amd:data.amd,levels:{...levels}};}
function download(body,type,name){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function totals(){
 for(const [id,names] of [['mix-total',S.COUNT_NAMES.slice(0,3)],['unload-total',S.COUNT_NAMES.slice(3)]]){
  const total=names.reduce((sum,name)=>sum+data.counts[name],0);
  $(id).textContent=total ? total+' total' : '';
 }
}
function renderCounters(){for(const name of S.COUNT_NAMES)$('n-'+name.replace(' ','-')).textContent=data.counts[name]===0?'':data.counts[name];totals();}
for(const [parent,names] of [[$('mix'),S.COUNT_NAMES.slice(0,3)],[$('trucks'),S.COUNT_NAMES.slice(3)]]){
 for(const name of names){const card=document.createElement('article');card.className='counter';
 const label=document.createElement('span');label.className='counter-label';label.textContent=name;
 const count=document.createElement('div');count.className='counter-value';count.id='n-'+name.replace(' ','-');count.textContent=data.counts[name]===0?'':data.counts[name];
 const button=document.createElement('button');button.type='button';button.className='plus';button.textContent='+';button.setAttribute('aria-label','Add one to '+name);
 button.onclick=()=>{if(!Number.isSafeInteger(data.counts[name]+1)){notify('Count is at the maximum supported value.');return;}
 const previous=data.counts[name];data.counts[name]++;if(!persist(K.counts,data)){data.counts[name]=previous;return;}
 undo.push({name,value:previous});if(undo.length>30)undo.shift();renderCounters();};
 card.append(label,count,button);parent.append(card);}
}
for(const key of ['pounds','amd']){const input=$(key);input.value=Number(data[key])===0?"":data[key];input.oninput=()=>{if(!input.validity.valid)return;const previous=data[key];data[key]=input.value;if(!persist(K.counts,data)){data[key]=previous;input.value=previous;}};input.onchange=()=>{if(!input.validity.valid){notify('Check the '+(key==='amd'?'AMD percentage (0–100).':'tank weight (zero or greater).'));input.focus();}};}
for(const name of S.LEVEL_NAMES){const card=document.createElement('div');card.className='level';
 const label=document.createElement('label');label.htmlFor='level-'+name;label.textContent=name;
 const wrap=document.createElement('div');wrap.className='input-unit';const input=document.createElement('input');
 Object.assign(input,{id:'level-'+name,type:'number',inputMode:'decimal',min:'0',max:'99',step:'any',placeholder:' ',value:Number(levels[name])===0?'':levels[name]});input.setAttribute('aria-label',name+' level percentage');
 const unit=document.createElement('span');unit.textContent='%';
 input.oninput=()=>{if(!input.validity.valid)return;const previous=levels[name];levels[name]=input.value;if(!persist(K.levels,levels)){levels[name]=previous;input.value=previous;}};
 input.onchange=()=>{if(!input.validity.valid){notify('Tank levels must be from 0 to 99%.');input.focus();}};
 wrap.append(input,unit);card.append(label,wrap);$('level-counters').append(card);
}
function undoCategory(names){const index=undo.findLastIndex(item=>names.includes(item.name));const item=undo[index];if(!item){notify('No recent tap to undo.');return;}const current=data.counts[item.name];data.counts[item.name]=item.value;if(!persist(K.counts,data)){data.counts[item.name]=current;return;}undo.splice(index,1);renderCounters();notify('Undid '+item.name+'.');}
$('undo-mix').onclick=()=>undoCategory(S.COUNT_NAMES.slice(0,3));
$('undo-unload').onclick=()=>undoCategory(S.COUNT_NAMES.slice(3));
function archive(){const next=[snapshot(),...archives].slice(0,120);if(!persist(K.archives,next))return false;archives=next;return true;}
$('reset').onclick=()=>{if(!confirm('Reset mix/unload counts, hold pounds and AMD? A snapshot will be saved first.'))return;if(!archive())return;
 const previous=data;data=S.normalizeCounts({pounds:'0',amd:'0'});if(!persist(K.counts,data)){data=previous;return;}
 undo=[];renderCounters();$('pounds').value='';$('amd').value='';notify('Counts reset. Previous snapshot saved on device.');};
$('reset-levels').onclick=()=>{if(!confirm('Reset all tank levels to zero? A snapshot will be saved first.'))return;if(!archive())return;const previous=levels;
 levels=Object.fromEntries(S.LEVEL_NAMES.map(k=>[k,'0']));if(!persist(K.levels,levels)){levels=previous;return;}for(const k of S.LEVEL_NAMES)$('level-'+k).value='';notify('Levels reset. Previous snapshot saved on device.');};
function validReadings(ids){for(const id of ids){if(!$(id).validity.valid){notify('Check the highlighted reading before sharing.');$(id).reportValidity();$(id).focus();return false;}}return true;}
async function share(text){if(navigator.share){try{await navigator.share({text});return;}catch(e){if(e.name==='AbortError')return;}}location.href='sms:&body='+encodeURIComponent(text);}
$('share').onclick=()=>{if(!validReadings(['pounds','amd']))return;const lines=S.COUNT_NAMES.filter(n=>data.counts[n]>0).map(n=>n+': '+data.counts[n]);if(data.pounds!==''&&Number(data.pounds)!==0)lines.push('Hold: '+Number(data.pounds).toLocaleString('en-US')+' lb');if(data.amd!==''&&Number(data.amd)!==0)lines.push('AMD: '+data.amd+'%');if(!lines.length){notify('Nothing recorded to share.');return;}share(lines.join('\n'));};
$('share-levels').onclick=()=>{if(!validReadings(S.LEVEL_NAMES.map(name=>'level-'+name)))return;const lines=S.LEVEL_NAMES.filter(n=>levels[n]!==''&&Number(levels[n])>0).map(n=>n+': '+levels[n]+'%');if(!lines.length){notify('No levels recorded to share.');return;}share(lines.join('\n'));};
$('export').onclick=()=>{const rows=[['Timestamp','Mix 1','Mix 2','Mix 3','Pounds','AMD %','AA','NA','AN'],[new Date().toISOString(),...S.COUNT_NAMES.slice(0,3).map(n=>data.counts[n]),data.pounds,data.amd,...S.COUNT_NAMES.slice(3).map(n=>data.counts[n])]];download(rows.map(row=>row.map(S.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8','sterling-counts-'+S.workday()+'.csv');};
$('calculate').onclick=()=>{const input=$('mix-input'),n=Number(input.value);if(input.value.trim()===''||!Number.isFinite(n)||n<0){notify('Enter a pounds value of zero or greater.');input.focus();return;}$('conversion-result').textContent=Math.ceil(n/2.205).toLocaleString('en-US')+' kg';input.blur();};
$('mix-input').onkeydown=e=>{if(e.key==='Enter')$('calculate').click();};
function dailyValue(key){try{return localStorage.getItem(key);}catch{return null;}}
function markDaily(key){try{localStorage.setItem(key,S.workday());paintDaily();}catch{notify('Could not save the daily indicator.');}}
function paintDaily(){const day=S.workday(),bbs=dailyValue(K.bbs)===day,report=dailyValue(K.report)===day;
 $('bbs-request').classList.toggle('done',bbs);$('report-request').classList.toggle('done',report);
 $('bbs-request').setAttribute('aria-label',bbs?'BBS selected for this workday':'Open BBS');$('report-request').setAttribute('aria-label',report?'Report selected for this workday; open ChatGPT':'Give a shift report in ChatGPT');
 
 clearTimeout(dayTimer);if(!document.hidden)dayTimer=setTimeout(paintDaily,60000-Date.now()%60000+40);
}
$('bbs-request').addEventListener('click',()=>markDaily(K.bbs));
const reportDialog=$('report-panel'),reportNotes=$('report-notes'),reportError=$('report-error');
$('report-request').onclick=()=>{reportError.hidden=true;reportDialog.showModal();};
reportDialog.addEventListener('click',event=>{
 if(event.target===reportDialog)reportDialog.close();
});
reportDialog.addEventListener('close',()=>menuToggle.focus());
$('report-form').onsubmit=event=>{
 event.preventDefault();
 const notes=reportNotes.value.trim();
 const url='https://chatgpt.com/?q='+encodeURIComponent('Sterling report\n\n'+notes);
 const error=!notes?'Enter your report.':!navigator.onLine?'Reconnect to open ChatGPT.':url.length>14000?'Shorten the report to open it in ChatGPT.':'';
 if(error){reportError.textContent=error;reportError.hidden=false;reportNotes.focus();return;}
 window.open(url,'_blank','noopener,noreferrer');
 markDaily(K.report);
 reportDialog.close();
};
function loadCalendar(){if($('calendar-holder').childElementCount||!navigator.onLine)return;
 const iframe=document.createElement('iframe');iframe.title='Google Calendar agenda';iframe.loading='lazy';iframe.referrerPolicy='no-referrer';iframe.src='https://calendar.google.com/calendar/embed?mode=AGENDA&showTitle=0&showCalendars=0&showPrint=0&showTabs=0&ctz=America%2FChicago&src=jasonjaggers%40gmail.com';$('calendar-holder').append(iframe);
}
window.addEventListener('online',loadCalendar);
window.addEventListener('storage',event=>{if(event.key===K.counts){data=S.normalizeCounts(read(K.counts,{}));undo=[];renderCounters();$('pounds').value=Number(data.pounds)===0?'':data.pounds;$('amd').value=Number(data.amd)===0?'':data.amd;}
 if(event.key===K.levels){levels=S.normalizeLevels(read(K.levels,{}));for(const n of S.LEVEL_NAMES)$('level-'+n).value=Number(levels[n])===0?'':levels[n];}
 if(event.key===K.archives)archives=array(read(K.archives,[]));paintDaily();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(dayTimer);}else{paintDaily();loadCalendar();}});
window.addEventListener('focus',paintDaily);window.addEventListener('pageshow',paintDaily);
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  window.addEventListener('online',()=>reg.update().catch(()=>{}));
 }).catch(()=>notify('Offline setup could not finish. Your saved data is kept.'));
}
renderCounters();paintDaily();loadCalendar();
if(storageBlocked)notify('Device storage is unavailable. Check available storage before resetting.');
})();
