'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8'),sql=fs.readFileSync(path.join(root,'supabase/migrations/20261111215000_agenda_voluntarios_v124.sql'),'utf8');
async function mod(){return import(pathToFileURL(path.join(root,'agenda.js')).href)}
test('próximo mês cruza dezembro/janeiro sem perder o ano',async()=>{
 const a=await mod(),now=new Date(2026,11,31,12);
 assert.equal(a.firstMonth(1,now),'2027-01-01');
 assert.equal(a.lastMonthExclusive(1,now),'2027-02-01');
 assert.equal(a.monthDays('2027-02-01').length,28);
});
test('domingo permite manhã/noite; quarta apenas noite',async()=>{
 const a=await mod();
 assert.deepEqual(a.slotsForDate('2026-12-06'),['domingo_manha','domingo_noite']);
 assert.deepEqual(a.slotsForDate('2026-12-09'),['quarta_noite']);
 assert.deepEqual(a.slotsForDate('2026-12-10'),[]);
 assert.equal(a.validSlot('2026-12-09','domingo_noite'),false);
 assert.equal(a.validSlot('2026-02-31','domingo_manha'),false);
});
test('próxima escala ordena datas/horários reais e ignora turnos passados',async()=>{
 const a=await mod(),rows=[
  {dia:'2026-12-13',culto:'domingo_noite',horario:'19:00:00'},
  {dia:'2026-12-06',culto:'domingo_manha',horario:'09:00:00'},
  {dia:'2026-12-06',culto:'domingo_noite',horario:'18:30:00'},
 ];
 assert.equal(a.nextShift(rows,new Date(2026,11,6,9,5)).horario,'18:30:00');
 assert.equal(a.nextShift(rows,new Date(2026,11,14,9,5)),null);
});
test('cartões mostram dados efetivos e não inventam escala',async()=>{
 const a=await mod(),day=a.monthDays(a.firstMonth(1)).find(d=>a.slotsForDate(d).length);
 const ui=a.volunteerAgendaUI({rows:[],availability:[],selectedDate:day,labels:{professor:'Professor'},esc:x=>String(x)});
 assert.match(ui,/Aguardando a próxima escala/);
 assert.match(ui,/Quando posso servir/);
 const next=a.firstMonth(1);const sundays=a.monthDays(next).filter(d=>a.slotsForDate(d).includes('domingo_manha'));
 assert.equal(sundays.length>=4,true);
 const published=a.volunteerAgendaUI({rows:[{pessoa_id:'x',dia:sundays[0],culto:'domingo_manha',horario:'09:00',turma:'Maternal',funcao:'professor'}],availability:[],selectedDate:day,labels:{professor:'Professor'},esc:x=>String(x)});
 assert.match(published,/turma|Turma/i);
});
test('RLS: somente usuário ativo edita a própria disponibilidade no mês seguinte',()=>{
 assert.match(sql,/pessoa_id=\(select auth\.uid\(\)\) and \(select private\.ativo\(\)\)/);
 assert.match(sql,/date_trunc\('month',now\(\) at time zone 'America\/Sao_Paulo'\)\+interval '1 month'\)/);
 assert.match(sql,/disponibilidades_dia_culto/);
 assert.match(sql,/domingo_manha','domingo_noite/);
 assert.match(sql,/quarta_noite/);
 assert.doesNotMatch(sql,/create or replace function.*kids-auth/si);
});
test('RLS: apenas gestor ativo publica escala; cadastro antigo intacto',()=>{
 assert.match(sql,/private\.admin_ativo\(\)/);
 assert.match(sql,/private\.lider_ativo\(\)/);
 assert.match(sql,/escalas_lider_inserir/);
 assert.match(sql,/escalas_lider_remover/);
 assert.doesNotMatch(sql,/drop table|alter table public\.perfis|alter table public\.convites|delete from auth\.users|truncate/i);
 assert.match(js,/case 'escala':return state\.agendaError/);
 assert.match(js,/data-form='schedule'|id==='schedule'/);
 assert.match(js,/id==='login'/);
 assert.match(js,/id==='signup'/);
 assert.match(js,/id==='invite'/);
});

test('primeira instalação do PWA não recarrega o login; atualização só com consentimento',()=>{
 assert.match(js,/let userAcceptedUpdate = false/);
 assert.match(js,/if \(refreshing \|\| !userAcceptedUpdate\) return/);
 assert.match(js,/userAcceptedUpdate = true/);
 assert.match(js,/registration\.waiting\?\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/);
});
