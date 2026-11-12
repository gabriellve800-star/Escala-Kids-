'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const base=read('supabase/migrations/20261112182638_fase3_kids_base_rls.sql');
const index=read('supabase/migrations/20261112182641_fase3_fk_indices_private_deny.sql');
const identity=read('supabase/migrations/20261112182648_fase3_separar_identidades.sql');
const audit=read('supabase/migrations/20261112182651_fase3_auditoria_acessos_turma.sql');
const sql=read('supabase/tests/fase3_kids_rls_rollback.sql');

test('fase 3: 4 turmas editaveis, identificadores UUID sem texto de escala',()=>{
 assert.match(base,/posicao between 1 and 4/);
 assert.match(base,/idade_min_meses smallint/);
 assert.match(base,/idade_max_meses smallint/);
 assert.match(base,/create table public\.escalas_turmas_kids/);
 assert.match(base,/m\.turma_id=p_turma/);
 assert.doesNotMatch(base,/e\.turma\s*=\s*t\.nome/);
});
test('fase 3: equipe delegada somente pelo admin, por permissao explicita',()=>{
 assert.match(base,/permissoes_inserir_admin/);
 assert.match(base,/concedida_por=\(select auth\.uid\(\)\)/);
 assert.match(base,/private\.tem_permissao_kids/);
 assert.match(base,/private\.admin_ativo\(\)/);
 assert.match(base,/private\.equipe_ativa\(\)/);
 assert.match(identity,/trg_kids_separar_perfil_equipe/);
 assert.match(identity,/trg_kids_separar_perfil_familia/);
});
test('fase 3: saude e token push em private, deny all, sem grants',()=>{
 for(const name of ['saude_kids','assinaturas_push_kids','convites_familia_kids','retencao_kids']){
  assert.match(base,new RegExp('create table private\\.'+name));
  assert.match(index,new RegExp('on private\\.'+name));
 }
 assert.match(base,/revoke all on private\.saude_kids/);
 assert.doesNotMatch(base,/grant select on private\.saude_kids to authenticated/i);
 assert.doesNotMatch(base,/grant select on private\.assinaturas_push_kids to authenticated/i);
});
test('fase 3: criancas e chamados nao aceitam escrita direta do cliente',()=>{
 for(const t of ['criancas_kids','vinculos_kids','consentimentos_kids','presencas_kids','chamados_kids']){
   assert.match(base,new RegExp('create table public\\.'+t));
   assert.match(base,new RegExp('grant select on public\\.'+t+' to authenticated;'));
   assert.doesNotMatch(base,new RegExp('grant .*insert.* on public\\.'+t+' to authenticated;','i'));
 }
 assert.match(base,/private\.pode_ver_crianca_kids\(id\)/);
 assert.match(base,/private\.familia_vinculada_kids\(crianca_id\)/);
});
test('fase 3: ANAD imutavel e gerado por identity no servidor',()=>{
 assert.match(base,/generated always as identity/);
 assert.match(base,/'ANAD-' \|\| lpad/);
 assert.match(base,/trg_anad_nao_editar/);
 assert.match(base,/raise exception 'IDENTIFICADOR_IMUTAVEL'/);
});
test('fase 3: cobertura temporaria so por lider, prazo e auditoria',()=>{
 assert.match(base,/cobertura_criar/);
 assert.match(base,/private\.lider_ativo\(\)/);
 assert.match(base,/expira_em<=now\(\)\+interval '24 hours'/);
 assert.match(audit,/tr_coberturas_kids_audit/);
 assert.match(audit,/tr_escalas_turmas_kids_audit/);
});
test('fase 3: testes SQL negativos sao reversiveis e cobrem familia A/B',()=>{
 assert.match(sql,/^begin;/m);
 assert.match(sql,/^rollback;/m);
 assert.match(sql,/FASE3_RLS_NEGATIVE_TESTS_OK/);
 for(const token of ['familia A ve filho da familia B','familia B ve filho A',
    'voluntario comum ve criancas','professor ve turmas sem escala HOJE',
    'SAUDE_LIBERADA_INDEVIDAMENTE','IDENTIDADE_SEPARADA_NECESSARIA',
    'ANAD_EDITAVEL_COM_DEFAULT'])
   assert.ok(sql.includes(token),'Falta teste: '+token);
});
test('fase 3: nao muda codigo, RLS ou tabelas originais da agenda e login',()=>{
 const joined=[base,index,identity,audit].join('\n');
 assert.doesNotMatch(joined,/drop table|truncate table|delete from auth\.users/i);
 assert.doesNotMatch(joined,/alter table public\.escalas\b|alter table public\.convites\b/i);
 assert.match(joined,/create or replace function private\.ativo\(\)/);
 assert.match(identity,/before insert or update of id on public\.perfis/);
 const app=read('app.js');
 assert.match(app,/id==='login'/);
 assert.match(app,/id==='signup'/);
 assert.match(app,/agenda-save/);
});
