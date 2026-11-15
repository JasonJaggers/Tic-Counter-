// Sterling Mix — Scriptable Home Screen widget
// Install as a Scriptable script named "Sterling Mix".
// Tapping + launches Scriptable, records the tap, then opens Sterling to sync.
(async()=>{
'use strict';
const N=['Mix 1','Mix 2','Mix 3','AA','NA','AN'];
const BASE='https://jasonjaggers.github.io/Tic-Counter-/';
const fm=FileManager.local(),file=fm.joinPath(fm.documentsDirectory(),'sterling-widget-counters-v2.json');
const params=args.queryParameters||{};
const today=()=>new Date().toISOString();
function clean(o){
 const c={};for(const n of N){const v=o&&o[n];c[n]=Number.isSafeInteger(v)&&v>=0?v:0;}return c;
}
function load(){
 try{if(fm.fileExists(file)){const v=JSON.parse(fm.readString(file));return {counts:clean(v.counts),updated:v.updated||null,known:!!v.known};}}catch{}
 return {counts:clean({}),updated:null,known:false};
}
function save(state){fm.writeString(file,JSON.stringify(state));}
function workday(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
 const d=new Date(Date.UTC(p.year,p.month-1,p.day));if(p.hour*60+p.minute<370)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);
}
let state=load();
if(!config.runsInWidget&&params.snapshot){
 try{
  const v=JSON.parse(params.snapshot);
  if(v.schema!==1&&v.schema!==2)throw Error('Invalid version');
  const stamp=Date.parse(v.updated_at);
  if(!Number.isFinite(stamp)||stamp>Date.now()+300000||v.workday!==workday())throw Error('Snapshot is not current');
  const source=v.schema===2?v.counts:v.mixes;
  for(const n of v.schema===2?N:N.slice(0,3))if(!Number.isSafeInteger(source?.[n])||source[n]<0)throw Error('Invalid count');
  if(!state.updated||stamp>=Date.parse(state.updated)){
   state={counts:clean({...state.counts,...source}),updated:v.updated_at,known:true};save(state);
  }
 }catch(e){const a=new Alert();a.title='Widget not updated';a.message='The snapshot was invalid or expired. Existing counts were kept.';a.addAction('OK');await a.presentAlert();}
}
if(!config.runsInWidget&&params.inc){
 const n=params.inc;
 if(N.includes(n)){
  if(!Number.isSafeInteger(state.counts[n]+1))throw Error('Counter limit reached');
  const previous=state;
  state={counts:{...state.counts,[n]:state.counts[n]+1},updated:today(),known:true};
  try{save(state);}catch(e){state=previous;throw e;}
  const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
  Safari.open(BASE+'?widget_counter='+encodeURIComponent(n)+'&widget_event='+encodeURIComponent(id));
  Script.complete();
  return;
 }
}
const w=new ListWidget();w.backgroundColor=new Color('0c121c');w.setPadding(13,13,12,13);
const heading=w.addStack();heading.layoutHorizontally();
const title=heading.addText('STERLING');title.font=Font.boldSystemFont(12);title.textColor=new Color('91e1d3');
heading.addSpacer();const day=heading.addText(workday());day.font=Font.mediumSystemFont(9);day.textColor=new Color('899db8');
w.addSpacer(7);
const family=config.widgetFamily||'medium';
for(let section=0;section<2;section++){
 const label=w.addText(section===0?'MIX TANKS':'TRUCK UNLOADS');
 label.font=Font.mediumSystemFont(9);label.textColor=new Color('91a2bb');
 w.addSpacer(3);
 const row=w.addStack();row.layoutHorizontally();row.spacing=7;
 for(const n of N.slice(section*3,section*3+3)){
  const cell=row.addStack();cell.layoutVertically();cell.backgroundColor=new Color('182433');cell.cornerRadius=10;cell.setPadding(7,8,7,8);
  const head=cell.addText(n.toUpperCase());head.font=Font.mediumSystemFont(9);head.textColor=new Color('a9b8cc');
  const value=cell.addStack();value.layoutHorizontally();
  const count=value.addText(state.known?String(state.counts[n]):'—');count.font=Font.boldMonospacedSystemFont(21);count.textColor=new Color('f5f7fb');
  value.addSpacer();
  const plus=value.addText('＋');plus.font=Font.boldSystemFont(20);plus.textColor=new Color('70e2c1');
  cell.url='scriptable:///run?scriptName=Sterling%20Mix&inc='+encodeURIComponent(n);
  if(n!==N[section*3+2])row.addSpacer(3);
 }
 if(section===0)w.addSpacer(9);
}
w.addSpacer();
const foot=w.addText(state.known?'Tap ＋ to record · opens Sterling':'Open Sterling → Update widget to load counts');
foot.font=Font.mediumSystemFont(9);foot.textColor=new Color('899db8');
w.refreshAfterDate=new Date(Date.now()+10*60000);
Script.setWidget(w);
if(!config.runsInWidget)await w.presentLarge();
Script.complete();
})().catch(async e=>{if(!config.runsInWidget){const a=new Alert();a.title='Sterling Widget';a.message=String(e.message||e);a.addAction('OK');await a.presentAlert();}Script.complete();});
