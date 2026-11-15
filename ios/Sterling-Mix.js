// Sterling Mix — paste into Scriptable and name the script exactly: Sterling Mix
// Displays the last snapshot sent from Sterling. No network requests or API keys.
// Home Screen refresh timing is controlled by iOS. This is not live browser data.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports&&typeof process!=='undefined')module.exports=api;
  else api.run(root).catch(async()=>{try{if(!root.config.runsInWidget){const alert=new root.Alert();alert.title='Sterling Mix';alert.message='Could not update the widget. The previous snapshot was kept. Check the script setup and try again.';alert.addAction('OK');await alert.presentAlert();}}finally{root.Script.complete();}});
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const NAMES=['Mix 1','Mix 2','Mix 3'];
function workday(now){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  const d=new Date(Date.UTC(p.year,p.month-1,p.day));if(p.hour*60+p.minute<370)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);
}
function validate(value,now=new Date()){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==1)throw Error('Invalid snapshot');
  const stamp=typeof value.updated_at==='string'?Date.parse(value.updated_at):NaN;
  if(!Number.isFinite(stamp)||stamp>now.getTime()+300000||workday(new Date(stamp))!==value.workday)throw Error('Invalid snapshot time');
  const mixes={};for(const key of NAMES){const n=value.mixes?.[key];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw Error('Invalid mix count');mixes[key]=n;}
  const received=typeof value.received_at==='string'?Date.parse(value.received_at):stamp;
  return {schema:1,updated_at:new Date(stamp).toISOString(),workday:value.workday,mixes,received_at:new Date(Number.isFinite(received)&&received<=now.getTime()+300000?received:stamp).toISOString()};
}
function parse(text,now){if(typeof text!=='string'||text.length>2000)throw Error('Invalid snapshot size');return validate(JSON.parse(text),now);}
function load(fm,now){
  const slots=['sterling-mix-a-v1.json','sterling-mix-b-v1.json'].map(name=>fm.joinPath(fm.documentsDirectory(),name));
  const valid=[];for(const path of slots){try{if(fm.fileExists(path)&&fm.fileSize(path)<=4)valid.push({path,data:parse(fm.readString(path),now)});}catch{}}
  valid.sort((a,b)=>Date.parse(b.data.received_at)-Date.parse(a.data.received_at)||Date.parse(b.data.updated_at)-Date.parse(a.data.updated_at));
  return {slots,current:valid[0]||null};
}
function receive(fm,text,now=new Date()){
  const incoming=parse(text,now),old=load(fm,now);
  if(old.current&&Date.parse(incoming.updated_at)<Date.parse(old.current.data.updated_at))throw Error('Older snapshot ignored');
  incoming.received_at=now.toISOString();
  const target=old.slots.find(path=>path!==old.current?.path)||old.slots[0];
  // Write the other slot, then read it back. Failure cannot erase the current slot.
  fm.writeString(target,JSON.stringify(incoming));
  const confirmed=parse(fm.readString(target),now);
  if(JSON.stringify(confirmed)!==JSON.stringify(incoming))throw Error('Snapshot verification failed');
  return incoming;
}
function status(data,now=new Date()){
  if(!data)return {label:'Send counts from Sterling',detail:'No snapshot yet',stale:true};
  const age=Math.max(0,now.getTime()-Date.parse(data.updated_at));
  const previous=data.workday!==workday(now),stale=previous||age>=3600000;
  const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(data.updated_at));
  return {label:(previous?'Previous workday':stale?'Old snapshot':'Last shared')+' · '+time+' CT',detail:'Update manually in Sterling',stale};
}
function render(env,data,now=new Date()){
  const w=new env.ListWidget(),small=env.config.widgetFamily==='small';
  w.backgroundColor=new env.Color('0c121c');w.setPadding(14,14,12,14);
  w.url='scriptable:///run?scriptName='+encodeURIComponent(env.Script.name());
  const title=w.addText('STERLING');title.font=env.Font.boldSystemFont(10);title.textColor=new env.Color('a2e4d5');
  w.addSpacer(4);const subtitle=w.addText('MIX COUNTS');subtitle.font=env.Font.mediumSystemFont(8);subtitle.textColor=new env.Color('91a2bb');
  w.addSpacer();const row=w.addStack();row.layoutHorizontally();row.spacing=small?7:16;
  for(let index=0;index<NAMES.length;index++){
    if(index)row.addSpacer();
    const column=row.addStack();column.layoutVertically();
    const name=column.addText(NAMES[index].toUpperCase());name.font=env.Font.mediumSystemFont(small?8:10);name.textColor=new env.Color('91a2bb');
    column.addSpacer(5);const value=column.addText(data?String(data.mixes[NAMES[index]]):'—');
    value.font=env.Font.boldMonospacedSystemFont(small?24:34);value.textColor=new env.Color('eef3f9');value.minimumScaleFactor=0.25;value.lineLimit=1;
  }
  w.addSpacer();const state=status(data,now),footer=w.addText(state.label);footer.font=env.Font.mediumSystemFont(small?8:9);footer.textColor=new env.Color(state.stale?'eac48d':'91a2bb');footer.lineLimit=2;footer.minimumScaleFactor=0.75;
  w.addSpacer(3);const hint=w.addText(state.detail);hint.font=env.Font.regularSystemFont(8);hint.textColor=new env.Color('6e839f');hint.lineLimit=1;
  w.refreshAfterDate=new Date(now.getTime()+10*60000);
  return w;
}
async function run(env){
  const now=new Date(),fm=env.FileManager.local();let data=load(fm,now).current?.data||null;
  const incoming=env.args.queryParameters?.snapshot;
  if(incoming!==undefined&&!env.config.runsInWidget){
    try{data=receive(fm,incoming,now);}catch{
      const alert=new env.Alert();alert.title='Snapshot not imported';alert.message='The update was invalid, older than the saved snapshot, or could not be saved. Your previous counts were kept.';alert.addAction('OK');await alert.presentAlert();
    }
  }
  const widget=render(env,data,now);env.Script.setWidget(widget);
  if(!env.config.runsInWidget)await widget.presentMedium();
  env.Script.complete();
}
return {NAMES,workday,validate,parse,load,receive,status,render,run};
});
