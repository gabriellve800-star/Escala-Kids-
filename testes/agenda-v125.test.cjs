'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const moduleAt=name=>import(pathToFileURL(path.join(root,name)).href);

function fakeDb(failAt=0,failRollback=false) {
  let writes=0;const calls=[];
  const reply=(type,row)=>{
    writes++;calls.push({type,row});
    return Promise.resolve({error:writes===failAt || (failRollback&&writes>failAt)
      ?new Error('network unavailable'):null});
  };
  return {calls,from(name){
    assert.equal(name,'disponibilidades');
    return {
      insert:row=>reply('add',row),
      delete:()=>({match:row=>reply('remove',row)}),
    };
  }};
}
const validEntry=()=>true;
test('rascunho local difere do enviado e cancelar não toca no banco',async()=>{
  const a=await moduleAt('availability-draft.js');
  const base=new Set(['2026-12-06|domingo_manha']);
  const draft=a.toggleSelection(base,null,'2026-12-06|domingo_noite');
  assert.deepEqual([...base],['2026-12-06|domingo_manha']);
  assert.deepEqual([...draft],['2026-12-06|domingo_manha','2026-12-06|domingo_noite']);
  assert.deepEqual(a.availabilityDiff(base,draft),{add:[{dia:'2026-12-06',culto:'domingo_noite'}],remove:[]});
  assert.equal(a.toggleSelection(base,draft,'2026-12-06|domingo_noite'),null);
});
test('envio faz só o diff: insert do novo e delete do desmarcado',async()=>{
  const a=await moduleAt('availability-draft.js'),sb=fakeDb();
  const base=new Set(['2026-12-06|domingo_manha']);
  const draft=new Set(['2026-12-06|domingo_noite']);
  const result=await a.saveAvailability({sb,userId:'pessoa-a',base,draft,validEntry});
  assert.deepEqual(result,{ok:true,changed:2});
  assert.deepEqual(sb.calls.map(x=>x.type),['add','remove']);
  assert.deepEqual(sb.calls.map(x=>x.row.pessoa_id),['pessoa-a','pessoa-a']);
  assert.deepEqual([...draft],['2026-12-06|domingo_noite']);
});
test('falha no segundo envio tenta desfazer primeiro, mantendo rascunho',async()=>{
  const a=await moduleAt('availability-draft.js'),sb=fakeDb(2);
  const base=new Set(),draft=new Set(['2026-12-06|domingo_manha','2026-12-06|domingo_noite']);
  const result=await a.saveAvailability({sb,userId:'pessoa-a',base,draft,validEntry});
  assert.equal(result.ok,false);
  assert.equal(result.partial,false);
  assert.match(result.message,/rascunho/);
  assert.deepEqual(sb.calls.map(x=>x.type),['add','add','remove']);
  assert.equal(draft.size,2);
});
test('falha na compensação informa risco de envio parcial',async()=>{
  const a=await moduleAt('availability-draft.js'),sb=fakeDb(2,true);
  const draft=new Set(['2026-12-06|domingo_manha','2026-12-06|domingo_noite']);
  const result=await a.saveAvailability({sb,userId:'pessoa-a',base:new Set(),draft,validEntry});
  assert.equal(result.ok,false);
  assert.equal(result.partial,true);
  assert.match(result.message,/Alguns períodos/);
  assert.equal(draft.size,2);
});
test('período inválido nunca dispara gravação',async()=>{
  const a=await moduleAt('availability-draft.js'),sb=fakeDb();
  const r=await a.saveAvailability({sb,userId:'pessoa-a',base:new Set(),draft:new Set(['2099-03-05|domingo_manha']),validEntry:()=>false});
  assert.equal(r.ok,false);assert.equal(sb.calls.length,0);
});
test('escala disponibilidades de terceiros não integra o rascunho voluntário',async()=>{
  const a=await moduleAt('availability-draft.js');
  const rows=[
    {pessoa_id:'eu',dia:'2026-12-06',culto:'domingo_manha'},
    {pessoa_id:'outro',dia:'2026-12-06',culto:'domingo_noite'},
  ];
  assert.deepEqual([...a.ownAvailability(rows,'eu')],['2026-12-06|domingo_manha']);
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261111215000_agenda_voluntarios_v124.sql'),'utf8');
  assert.match(app,/state\.schedules\.filter\(x=>x\.pessoa_id===state\.user\?\.id\)/);
  assert.match(app,/availability:state\.availability\.filter\(x=>x\.pessoa_id===state\.user\?\.id\)/);
  assert.match(migration,/pessoa_id=\(select auth\.uid\(\)\)/);
  // Teste de contrato; NÃO simula um JWT de voluntário no Supabase real.
});
test('calendário mostra "Enviado", "Selecionado" e "Retirar" de forma distinta',async()=>{
  const a=await moduleAt('agenda.js');
  const date=a.monthDays(a.firstMonth(1)).find(d=>a.slotsForDate(d).includes('domingo_manha'));
  const saved=[{dia:date,culto:'domingo_manha'}];
  const ui=a.volunteerAgendaUI({rows:[],availability:saved,draftSelection:new Set([date+'|domingo_noite']),
    selectedDate:date,labels:{},esc:x=>String(x)});
  assert.match(ui,/Retirar/);
  assert.match(ui,/Selecionado/);
  assert.match(ui,/agenda-date-draft/);
  assert.match(ui,/agenda-slot-status/);
});
function mockNav(){
  const nav={dataset:{},style:{},mounts:0,buttons:[],indicator:{style:{}}};
  Object.defineProperty(nav,'innerHTML',{set(html){
    this.mounts++;
    const ids=[...html.matchAll(/data-tab="([^"]+)"/g)].map(m=>m[1]);
    this.buttons=ids.map((id,i)=>{
      const classes=new Set(),attrs={},label={textContent:''};
      return {dataset:{tab:id},classList:{toggle:(name,ok)=>ok?classes.add(name):classes.delete(name),
        contains:name=>classes.has(name)},offsetLeft:10+i*90,offsetWidth:90,
        attrs,querySelector:selector=>selector==='.nav-label'?label:null,
        setAttribute:(name,value)=>{attrs[name]=value}};
    });
  }});
  nav.querySelectorAll=()=>nav.buttons;
  nav.querySelector=selector=>selector==='.nav-indicator'?nav.indicator:null;
  return nav;
}
test('nav mantém os mesmos botões e atualiza indicador/aria-current',async()=>{
  const n=await moduleAt('navigation.js'),nav=mockNav();
  const items=[['escala','Minha Escala','cal'],['inicio','Início','home'],['perfil','Perfil','user']];
  n.syncNavigation(nav,items,'escala',icon=>icon,x=>x);
  const firstButtons=nav.buttons,firstX=nav.indicator.style.transform;
  n.syncNavigation(nav,items,'perfil',icon=>icon,x=>x);
  assert.equal(nav.mounts,1);
  assert.strictEqual(nav.buttons,firstButtons);
  assert.equal(nav.buttons[2].attrs['aria-current'],'page');
  assert.equal(nav.buttons[0].attrs['aria-current'],'false');
  assert.notEqual(nav.indicator.style.transform,firstX);
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(app,/syncNavigation\(\$\('#nav'\),tabs\(\),state\.tab,ico,esc\)/);
});
test('PWA atualiza assets sem cachear APIs e preserva atualização consentida',()=>{
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const filename of ['availability-draft.js','navigation.js','agenda.js','app.js'])
    assert.ok(sw.includes(filename+'?v=1.2.5'));
  assert.match(sw,/url\.origin !== self\.location\.origin/);
  assert.match(sw,/allowed\.has\(url\.href\)/);
  assert.match(app,/let userAcceptedUpdate = false/);
  assert.match(html,/font.+display=swap/);
  assert.match(app,/beforeunload/);
});
