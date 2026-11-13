'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const planner=()=>import(pathToFileURL(path.join(root,'planner.js')).href);
const sql=read('supabase/migrations/20261113172500_v127_planejador_rascunho_aprovacao.sql');
const perms=read('supabase/migrations/20261113171500_v127_turmas_fixadas_permissoes.sql');
const app=read('app.js');
const klass=Array.from({length:4},(_,i)=>({id:'turma-'+(i+1),posicao:i+1,nome:'Turma de Teste '+(i+1),ativa:true}));
const workers=[
 ...Array.from({length:4},(_,i)=>({id:'prof-'+i,nome:'Professor '+i,funcoes:['professor']})),
 ...Array.from({length:4},(_,i)=>({id:'aux-'+i,nome:'Auxiliar '+i,funcoes:['auxiliar']})),
 {id:'port',nome:'Portaria Teste',funcoes:['portaria']},
 {id:'coz',nome:'Cozinha Teste',funcoes:['lanche']},
];
const makeBase=async(month='2026-12-01')=>{
 const m=await planner();
 const dates=m.sessionsForMonth(month);
 return {mes:month,turmas:klass,equipe:workers,
   disponibilidades:dates.flatMap(x=>workers.map(w=>({...x,pessoa_id:w.id}))),
   publicadas:[],rascunho:null,pode_editar:true,pode_aprovar:true};
};
test('v127: vagas fixas por turma e por função, sem inserir dados de crianças',async()=>{
 const m=await planner(),base=await makeBase();
 const draft=m.createSuggestion(base);
 assert.equal(draft.length,m.sessionsForMonth(base.mes).length*10);
 assert.equal(draft.filter(x=>x.funcao==='professor').length,m.sessionsForMonth(base.mes).length*4);
 assert.equal(draft.filter(x=>x.funcao==='auxiliar').length,m.sessionsForMonth(base.mes).length*4);
 assert.equal(draft.filter(x=>x.funcao==='portaria').length,m.sessionsForMonth(base.mes).length);
 assert.equal(draft.filter(x=>x.funcao==='lanche').length,m.sessionsForMonth(base.mes).length);
 assert.ok(draft.every(x=>Object.keys(x).sort().join(',')==='culto,dia,funcao,horario,pessoa_id,turma_id'));
 assert.ok(draft.every(x=>x.pessoa_id&&x.horario===null));
 assert.equal(m.summaryFor(draft,base).gaps,0);
});
test('v127: nunca escala a mesma pessoa duas vezes no mesmo culto',async()=>{
 const m=await planner(),base=await makeBase();
 const draft=m.createSuggestion(base);
 const keys=draft.map(x=>x.dia+'|'+x.culto+'|'+x.pessoa_id);
 assert.equal(new Set(keys).size,keys.length);
 for(const r of draft){
  const eligible=m.candidatePeople({...r,pessoa_id:null},base,[]);
  assert.ok(eligible.some(p=>p.id===r.pessoa_id));
 }
});
test('v127: falta de voluntários vira vaga aberta, nunca pessoa inventada',async()=>{
 const m=await planner(),base=await makeBase();
 base.equipe=base.equipe.filter(x=>x.funcoes[0]!=='auxiliar');
 base.disponibilidades=base.disponibilidades.filter(x=>!x.pessoa_id.startsWith('aux-'));
 const draft=m.createSuggestion(base),sum=m.summaryFor(draft,base);
 assert.equal(sum.gaps,m.sessionsForMonth(base.mes).length*4);
 assert.ok(draft.some(x=>x.funcao==='auxiliar'&&x.pessoa_id===null));
});
test('v127: escala já publicada ocupa a vaga e não designa a mesma pessoa',async()=>{
 const m=await planner(),base=await makeBase();
 base.publicadas=[{dia:'2026-12-02',culto:'quarta_noite',funcao:'professor',turma_id:klass[0].id,
   pessoa_id:'prof-0',horario:'19:00',turma:klass[0].nome}];
 const draft=m.createSuggestion(base);
 assert.equal(draft.find(s=>s.dia==='2026-12-02'&&s.culto==='quarta_noite'&&
   s.funcao==='professor'&&s.turma_id===klass[0].id).pessoa_id,null);
 const selected=draft.filter(s=>s.dia==='2026-12-02'&&s.culto==='quarta_noite'&&s.pessoa_id);
 assert.ok(!selected.some(s=>s.pessoa_id==='prof-0'));
 assert.equal(m.summaryFor(draft,base).occupied,1);
});
test('v127: troca do nome não muda UUID, nome não autoriza crianças',async()=>{
 assert.match(perms,/private\.kids_sincronizar_nome_turma/);
 assert.match(perms,/m\.turma_id=new\.id/);
 assert.match(perms,/private\.lider_ativo\(\)/);
 assert.match(perms,/montar_escalas/);
 assert.match(perms,/aprovar_escalas/);
 assert.match(app,/\.select\('id,nome'\)\.maybeSingle\(\)/);
 assert.match(app,/canManageClasses:isAdmin\(\)\|\|isLeader\(\)/);
});
test('v127: drafts não são escala oficial e aprovação é atômica e auditada',()=>{
 assert.match(sql,/create table private\.rascunhos_escala_kids/);
 assert.match(sql,/private\.kids_aprovar_sugestao/);
 assert.match(sql,/for update/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/VAGAS_SEM_EQUIPE/);
 assert.match(sql,/VOLUNTARIO_DUPLICADO_NO_CULTO/);
 assert.match(sql,/VOLUNTARIO_INDISPONIVEL_OU_SEM_FUNCAO/);
 assert.match(sql,/kids_escala_sugerida_aprovada/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.doesNotMatch(sql,/create function public\.[^;]*security definer/i);
});
test('v127: responsável e voluntário comum não têm permissão para planejar',()=>{
 assert.match(sql,/private\.equipe_ativa\(\)/);
 assert.match(sql,/if not private\.kids_pode_planejar\(\)/);
 assert.match(sql,/if not private\.kids_pode_aprovar_escala\(\)/);
 assert.match(sql,/revoke all on private\.rascunhos_escala_kids/);
 assert.match(sql,/create policy rascunho_escala_privado/);
});
