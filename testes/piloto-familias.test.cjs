'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>import(pathToFileURL(path.join(root,p)).href);
const age=()=>load('kids-age.js');
const ui=()=>load('kids-ui.js');
const sql=read('supabase/migrations/20261123043000_piloto_familias_classificacao_telefone.sql');
const app=read('app.js'),sw=read('sw.js'),html=read('index.html');

const classes=[
{id:'t1',posicao:1,nome:'Turma A',ativa:true,idade_min_meses:0,idade_max_meses:35},
{id:'t2',posicao:2,nome:'Turma B',ativa:true,idade_min_meses:36,idade_max_meses:71},
{id:'t3',posicao:3,nome:'Turma C',ativa:true,idade_min_meses:72,idade_max_meses:107},
{id:'t4',posicao:4,nome:'Turma D',ativa:true,idade_min_meses:108,idade_max_meses:215},
];
test('piloto: data inválida, futuro e leap day não geram turma',async()=>{
 const m=await age();
 assert.equal(m.completeMonths('2026-02-30','2026-11-22'),null);
 assert.equal(m.completeMonths('2027-01-01','2026-11-22'),null);
 assert.equal(m.completeMonths('2024-02-29','2024-03-28'),0);
 assert.equal(m.completeMonths('2024-02-29','2024-03-29'),1);
 assert.equal(m.completeMonths('2024-02-30','2024-03-29'),null);
 assert.equal(m.parseISODate('2024-02-29').day,29);
});
test('piloto: idade conta meses completos, sem arredondar aniversário',async()=>{
 const m=await age();
 assert.equal(m.completeMonths('2023-11-23','2026-11-22'),35);
 assert.equal(m.completeMonths('2023-11-22','2026-11-22'),36);
 assert.equal(m.completeMonths('2021-01-01','2026-11-22'),70);
});
test('piloto: turma única automaticamente, sem lacunas ou sobreposições',async()=>{
 const m=await age();
 assert.equal(m.suggestedClass('2023-11-23',classes,'2026-11-22').room.id,'t1');
 assert.equal(m.suggestedClass('2023-11-22',classes,'2026-11-22').room.id,'t2');
 assert.equal(m.suggestedClass('2020-01-01',classes,'2026-11-22').room.id,'t3');
 assert.equal(m.suggestedClass('2016-01-01',classes,'2026-11-22').room.id,'t4');
 assert.equal(m.suggestedClass('2026-12-01',classes,'2026-11-22').status,'data_invalida');
 assert.equal(m.suggestedClass('2020-01-01',classes.filter(x=>x.id!=='t3'),'2026-11-22').status,'sem_turma');
 assert.equal(m.suggestedClass('2023-11-23',[...classes,{...classes[0],id:'duplicate'}],'2026-11-22').status,'ambigua');
});
test('piloto: SQL protege turma, convite familiar e contato obrigatório',()=>{
 assert.match(sql,/TURMA_NAO_CORRESPONDE_IDADE/);
 assert.match(sql,/FAIXAS_ETARIAS_SOBREPOSTAS/);
 assert.match(sql,/IDADE_SEM_TURMA/);
 assert.match(sql,/trg_kids_validar_faixas_turmas/);
 assert.match(sql,/p_telefone !~/);
 assert.match(sql,/ATUALIZACAO_OBRIGATORIA/);
 assert.match(sql,/private\.kids_familias_revisao/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.match(sql,/private\.lider_ativo\(\)/);
 assert.doesNotMatch(sql,/insert into private\.termos_kids/i);
});
test('piloto: QR público sem token de convite individual',async()=>{
 const m=await ui();
 const out=m.kidsTeamUI({isAdmin:true,isLeader:true,classes:[],children:[],families:[],
   term:null,esc:String,canManageClasses:true,canRegisterChild:true,
   canInviteFamily:true,inviteCode:'',familyEntryLink:'https://example.invalid/kids/?familia=1'});
 assert.match(out,/kids-family-entry-qr/);
 assert.match(out,/\?familia=1/);
 assert.match(out,/kids-copy-family-link/);
 assert.doesNotMatch(out,/codigo_hash|senha|access_token/);
 assert.match(app,/publicFamilyEntryLink/);
 assert.match(app,/history\.replaceState/);
});
test('piloto: formulário familiar pede telefone e vínculo legal',async()=>{
 const m=await ui();
 const access=m.familyAccessUI({family:null,auth:'family-redeem',term:null,esc:String});
 assert.match(access,/name="fr-phone"/);
 const portal=m.familyPortalUI({family:{nome:'Teste Fictício',status:'ativo'},
   classes,children:[],links:[],requests:[],term:{versao:'QA-TESTE',texto:'Texto fictício'},esc:String,tab:'family'});
 assert.match(portal,/name="kid-legal-guardian"/);
 assert.match(portal,/name="kid-accept"/);
 assert.match(portal,/data-kid-birth/);
 assert.match(portal,/data-kid-room/);
 assert.doesNotMatch(portal,/name="kid-child-class"[^>]*value="t[1-4]"/);
 assert.match(app,/p_telefone:phone/);
 assert.match(app,/suggestedClass\(dob,state\.kidsClasses\)/);
});
test('piloto: cache PWA e scripts de idade atualizados',()=>{
 assert.match(html,/Escala Kids · v1\.2\.9/);
 assert.match(html,/app\.js\?v=1\.2\.9/);
 assert.match(sw,/escala-kids-v1\.2\.9-integrado/);
 assert.match(sw,/kids-age\.js\?v=1\.2\.9/);
 assert.match(app,/kids-age\.js\?v=1\.2\.9/);
});
