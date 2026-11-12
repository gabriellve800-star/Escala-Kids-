'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const sql=read('supabase/migrations/20261112203000_fase3_pr2_cadastro_transacional.sql');
const pending=read('supabase/migrations/20261112204500_fase3_pr2_familia_pendente_rls.sql');
const schedule=read('supabase/migrations/20261112210000_fase3_pr2_escala_id_turma.sql');
const guard=read('supabase/migrations/20261112211500_fase3_pr2_private_rpc_hardening.sql');
const app=read('app.js'),ui=read('kids-ui.js'),agenda=read('agenda.js');
const html=read('index.html'),sw=read('sw.js');
const q=read('supabase/tests/fase3_pr2_flows_rollback.sql');

test('PR2: familia e equipe sao identidades segregadas e nao herdam roles',()=>{
 assert.match(app,/state\.family/);
 assert.match(app,/\.from\('familias_kids'\)/);
 assert.match(app,/state\.profile=p;state\.family=null/);
 assert.match(sql,/if exists\(select 1 from public\.perfis where id=uid\)/);
 assert.doesNotMatch(app,/state\.profile\s*=\s*\{\s*perfil:\s*'voluntario'/);
});
test('PR2: consentimento e termo oficiais exigidos antes de gravar criancas',()=>{
 assert.match(sql,/create table if not exists private\.termos_kids/);
 assert.match(sql,/TERMO_NAO_PUBLICADO/g);
 assert.match(sql,/CONSENTIMENTO_OBRIGATORIO/);
 assert.match(sql,/p_aceite boolean default false/);
 assert.match(sql,/p_aceite is distinct from true/);
 assert.match(app,/p_aceite:id==='kids-child-family'/);
 assert.match(ui,/term\&\&classes\.some/);
 assert.match(q,/CONSENTIMENTO_OBRIGATORIO/);
});
test('PR2: IDs ANAD no servidor, fluxos de dupla confirmacao e equipe antes de ativo',()=>{
 assert.match(sql,/kids_criar_crianca\(/);
 assert.match(sql,/origem='familia';est='aguardando_equipe'/);
 assert.match(sql,/origem='equipe';est='consentimento_pendente'/);
 assert.match(sql,/kids_confirmar_filho\(/);
 assert.match(sql,/kids_aprovar_crianca\(/);
 assert.match(app,/kids_confirmar_filho/);
 assert.match(app,/kids_aprovar_crianca/);
});
test('PR2: familiares nao conseguem ver fichas alheias nem acesso ministerial',()=>{
 assert.match(pending,/private\.pode_ver_pendente_kids\(id\)/);
 assert.match(pending,/v\.responsavel_id=\(select auth\.uid\(\)\)/);
 assert.match(q,/familia B ve crianca A/);
 assert.match(q,/voluntario le fichas/);
 assert.match(q,/voluntario viu familias/);
 assert.match(app,/familyPortalUI/);
 assert.match(ui,/Sem escalas, equipe ou convites ministeriais/);
});
test('PR2: backend privilegiado privado, wrappers INVOKER na API',()=>{
 assert.match(guard,/security invoker set search_path=''/);
 assert.match(guard,/set schema private/g);
 assert.match(guard,/revoke execute on all functions in schema private from public,anon/);
 const count=(guard.match(/set schema private;/g)||[]).length;
 assert.equal(count,12);
 assert.doesNotMatch(guard,/create function public\.[\s\S]*?security definer/i);
});
test('PR2: convite separado, codigo aleatorio forte e hash, sem token em URL',()=>{
 assert.match(sql,/extensions\.gen_random_bytes\(32\)/);
 assert.match(sql,/private\.convites_familia_kids/);
 assert.match(sql,/extensions\.digest\(codigo,'sha256'\)/);
 assert.match(sql,/email_confirmed_at/);
 assert.match(sql,/limitar_cadastro/);
 assert.match(app,/kids_emitir_convite_familia/);
 assert.match(app,/kids_resgatar_convite_familia/);
 assert.doesNotMatch(app,/family_invite=\$\{/);
});
test('PR2: delegacao de permissoes e turmas no cadastro',()=>{
 assert.match(app,/kidsPermissionChips\(p\.id/);
 assert.match(ui,/Gerenciar turmas/);
 assert.match(ui,/Idade inicial \(meses\)/);
 assert.match(app,/kid-perm-change/);
 assert.match(app,/concedida_por:state\.user\.id/);
 assert.match(app,/isAdmin\(\)\|\|state\.kidsPermissions/);
});
test('PR2: escalas vinculam UUID da turma via transacao, e legado preservado',()=>{
 assert.match(agenda,/turmas\.some\(t=>t\.ativa\)/);
 assert.match(app,/kids_publicar_escala_turma/);
 assert.match(schedule,/on conflict\(pessoa_id,dia,culto\)/);
 assert.match(schedule,/escalas_turmas_kids/);
 assert.match(app,/sb\.from\('escalas'\)\.upsert/);
 assert.match(schedule,/private\.lider_ativo\(\)/);
});
test('PR2: privacidade e proibicao de fotos, dados de saude, push sensivel',()=>{
 assert.match(ui,/Privacidade/);
 assert.match(app,/kids_pedir_privacidade/);
 assert.doesNotMatch(ui,/<input[^>]+type="file"|<input[^>]+name="kid-health"/);
 assert.doesNotMatch(app,/console\.log\(.*(?:kidChild|kidsChildren|email|telefone)/);
 assert.match(sql,/kids_solicitacao_privacidade/);
});
test('PR2: cache PWA 1.2.6 e scripts atualizados de forma coerente',()=>{
 assert.match(html,/v1\.2\.6/);
 assert.match(html,/app\.js\?v=1\.2\.6/);
 assert.match(sw,/escala-kids-v1\.2\.6-familias/);
 assert.match(sw,/kids-ui\.js\?v=1\.2\.6/);
 assert.match(sw,/agenda\.js\?v=1\.2\.6/);
 assert.match(app,/kids-ui\.js\?v=1\.2\.6/);
 assert.match(app,/agenda\.js\?v=1\.2\.6/);
});

test('PR2: trocar de conta limpa dados infantis e descarta consultas atrasadas',()=>{
 assert.match(app,/function clearPrivateKidsState\(\)/);
 assert.match(app,/state\.kidsChildren=\[\];state\.kidsLinks=\[\]/);
 assert.match(app,/state\.user\?\.id!==loadingUser/);
 assert.match(app,/state\.user\.id!==u\.user\.id/);
});
test('PR2: familias pendentes podem exercer direitos LGPD',()=>{
 const migration=read('supabase/migrations/20261112213000_fase3_pr2_solicitacoes_lgpd.sql');
 assert.match(migration,/pendente','ativo','desativado/);
 assert.match(migration,/public\.solicitacoes_privacidade_kids/);
 assert.match(ui,/family-privacy-request/);
});
