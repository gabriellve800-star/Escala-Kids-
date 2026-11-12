'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/20261111193000_prod_limite_rede_compartilhada.sql');
const fn=read('supabase/functions/kids-auth/index.ts');
const sec=read('supabase/functions/kids-auth/auth-errors.mjs');
const html=read('index.html'),sw=read('sw.js'),app=read('app.js'),config=read('config.js');
const smoke=read('testes/prod-smoke.cjs');
const agenda=read('agenda.js'),agendaSql=read('supabase/migrations/20261111215000_agenda_voluntarios_v124.sql');
const wf=read('.github/workflows/prod-public-smoke.yml');
test('migration produção contém apenas limitador sobrecarregado e GRANT restrito',()=>{
 assert.match(sql,/create or replace function public\.limitar_cadastro\(p_chave text, p_max integer\)/i);
 assert.match(sql,/grant execute on function public\.limitar_cadastro\(text,integer\) to service_role/i);
 assert.doesNotMatch(sql,/qa_limpar_limites|create table|drop table|truncate|delete from|drop function|alter table|auth\.users/i);
});
test('função Edge tem mapeamento de erro e logs sanitizados',()=>{
 assert.match(fn,/import \{ mapCreateUserError \} from '\.\/auth-errors\.mjs'/);
 assert.match(fn,/request_id:requestId,stage:'createUser',field:mapped\.field\|\|'geral',code/);
 assert.match(fn,/safeErrorCode/);
 assert.match(fn,/request_id:requestId,stage:'rollback',field:'geral'/);
 assert.doesNotMatch(fn,/console\.(?:warn|log|error)\([^\n]*senha|console\.(?:warn|log|error)\([^\n]*email:/);
 assert.match(sec,/weak_password/);
});
test('site candidato v1.2.6 tem service worker e cache coerentes',()=>{
 assert.match(html,/<title>Escala Kids · v1\.2\.6<\/title>/);
 assert.match(html,/app\.js\?v=1\.2\.6/);
 assert.match(sw,/app\.js\?v=1\.2\.6/);
 assert.match(sw,/escala-kids-v1\.2\.6/);
 assert.match(app,/v1\.2\.6/);
 assert.match(config,/pntzfuxwkjreugxzovjj\.supabase\.co/);
 assert.doesNotMatch(config,/sb_secret_|eofoeijyfpptcktiqeah/i);
});
test('smoke público registra emails exatos previamente e limpa apenas IDs explícitos',()=>{
 assert.match(smoke,/expectedEmails/);
 assert.match(smoke,/expected\.has\(u\.email\)/);
 assert.match(smoke,/const generated=\(await users\(\)\)\.filter\(u=>expected\.has\(u\.email\)\)/);
 assert.match(smoke,/const unknown=\(await users\(\)\)\.filter/);
 assert.match(smoke,/NÃO excluí-las automaticamente/);
 assert.match(smoke,/\.delete\(\)\.in\('id',inviteIds\)/);
 assert.match(smoke,/\.delete\(\)\.in\('id',ids\)/);
 assert.doesNotMatch(smoke,/qa_limpar_limites|truncate\(/i);
 assert.match(smoke,/assert\.deepEqual\(post,s\.baseline/);
});
test('workflows de produção não usam segredos de QA nem fazem limpeza de tabelas',()=>{
 assert.match(wf,/PROD_SUPABASE_SECRET_KEY/);
 assert.doesNotMatch(wf,/QA_SUPABASE_SECRET_KEY|QA_SUPABASE_ACCESS_TOKEN|qa_limpar_limites|db reset/i);
 assert.match(wf,/testes\/prod-smoke\.cjs cleanup/);
});

test('agenda v1.2.4: módulo e migração aditiva preservam cadastro e proteção RLS',()=>{
 assert.match(agenda,/volunteerAgendaUI/);
 assert.match(agenda,/leaderAgendaUI/);
 assert.match(agenda,/domingo_manha/);
 assert.match(agendaSql,/create table if not exists public\.disponibilidades/);
 assert.match(agendaSql,/create table if not exists public\.escalas/);
 assert.match(agendaSql,/private\.ativo\(\)/);
 assert.match(agendaSql,/private\.lider_ativo\(\)/);
 assert.doesNotMatch(agendaSql,/drop table|alter table public\.perfis|alter table public\.convites|delete from auth\.users/);
});
