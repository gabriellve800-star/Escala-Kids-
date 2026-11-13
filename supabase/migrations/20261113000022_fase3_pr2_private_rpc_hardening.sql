-- PR2 hardening: public wrappers SECURITY INVOKER + private implementations
-- Não libera leitura direta de tabelas privadas. Database API pública sem definer.

grant usage on schema private to authenticated;
-- Apenas o validador do convite pode ser chamado anonimamente.
grant usage on schema private to anon;
revoke execute on all functions in schema private from public,anon;

alter function public.kids_termo_atual() set schema private;
create function public.kids_termo_atual()
returns table(versao text,texto text) language sql stable security invoker set search_path=''
as $wrapper$
  SELECT * FROM private.kids_termo_atual();
$wrapper$;
revoke all on function public.kids_termo_atual() from public,anon,authenticated;
grant execute on function public.kids_termo_atual() to authenticated;

alter function public.kids_emitir_convite_familia(integer) set schema private;
create function public.kids_emitir_convite_familia(p_dias integer default 7)
returns text language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_emitir_convite_familia(p_dias);
$wrapper$;
revoke all on function public.kids_emitir_convite_familia(integer) from public,anon,authenticated;
grant execute on function public.kids_emitir_convite_familia(integer) to authenticated;

alter function public.kids_convite_familia_valido(text) set schema private;
create function public.kids_convite_familia_valido(p_codigo text)
returns boolean language sql stable security invoker set search_path=''
as $wrapper$
  SELECT private.kids_convite_familia_valido(p_codigo);
$wrapper$;
revoke all on function public.kids_convite_familia_valido(text) from public,anon,authenticated;
grant execute on function public.kids_convite_familia_valido(text) to anon,authenticated;

alter function public.kids_resgatar_convite_familia(text,text) set schema private;
create function public.kids_resgatar_convite_familia(p_codigo text,p_nome text)
returns boolean language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_resgatar_convite_familia(p_codigo,p_nome);
$wrapper$;
revoke all on function public.kids_resgatar_convite_familia(text,text) from public,anon,authenticated;
grant execute on function public.kids_resgatar_convite_familia(text,text) to authenticated;

alter function public.kids_familias_pendentes() set schema private;
create function public.kids_familias_pendentes()
returns table(usuario_id uuid,nome text,status text,criado_em timestamptz) language sql stable security invoker set search_path=''
as $wrapper$
  SELECT * FROM private.kids_familias_pendentes();
$wrapper$;
revoke all on function public.kids_familias_pendentes() from public,anon,authenticated;
grant execute on function public.kids_familias_pendentes() to authenticated;

alter function public.kids_aprovar_familia(uuid) set schema private;
create function public.kids_aprovar_familia(p_responsavel uuid)
returns boolean language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_aprovar_familia(p_responsavel);
$wrapper$;
revoke all on function public.kids_aprovar_familia(uuid) from public,anon,authenticated;
grant execute on function public.kids_aprovar_familia(uuid) to authenticated;

alter function public.kids_criar_crianca(text,date,uuid,text,boolean) set schema private;
create function public.kids_criar_crianca(p_nome text,p_nascimento date,p_turma uuid,p_versao text default null,p_aceite boolean default false)
returns table(id uuid,numero text,status text) language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT * FROM private.kids_criar_crianca(p_nome,p_nascimento,p_turma,p_versao,p_aceite);
$wrapper$;
revoke all on function public.kids_criar_crianca(text,date,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.kids_criar_crianca(text,date,uuid,text,boolean) to authenticated;

alter function public.kids_vincular_responsavel(uuid,uuid) set schema private;
create function public.kids_vincular_responsavel(p_crianca uuid,p_responsavel uuid)
returns boolean language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_vincular_responsavel(p_crianca,p_responsavel);
$wrapper$;
revoke all on function public.kids_vincular_responsavel(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kids_vincular_responsavel(uuid,uuid) to authenticated;

alter function public.kids_confirmar_filho(uuid,text) set schema private;
create function public.kids_confirmar_filho(p_crianca uuid,p_versao text)
returns boolean language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_confirmar_filho(p_crianca,p_versao);
$wrapper$;
revoke all on function public.kids_confirmar_filho(uuid,text) from public,anon,authenticated;
grant execute on function public.kids_confirmar_filho(uuid,text) to authenticated;

alter function public.kids_aprovar_crianca(uuid) set schema private;
create function public.kids_aprovar_crianca(p_crianca uuid)
returns boolean language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_aprovar_crianca(p_crianca);
$wrapper$;
revoke all on function public.kids_aprovar_crianca(uuid) from public,anon,authenticated;
grant execute on function public.kids_aprovar_crianca(uuid) to authenticated;

alter function public.kids_pedir_privacidade(text,uuid) set schema private;
create function public.kids_pedir_privacidade(p_tipo text,p_crianca uuid default null)
returns boolean language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_pedir_privacidade(p_tipo,p_crianca);
$wrapper$;
revoke all on function public.kids_pedir_privacidade(text,uuid) from public,anon,authenticated;
grant execute on function public.kids_pedir_privacidade(text,uuid) to authenticated;

alter function public.kids_publicar_escala_turma(uuid,date,text,time,uuid,text) set schema private;
create function public.kids_publicar_escala_turma(p_pessoa uuid,p_dia date,p_culto text,p_horario time,p_turma uuid,p_funcao text)
returns uuid language sql volatile security invoker set search_path=''
as $wrapper$
  SELECT private.kids_publicar_escala_turma(p_pessoa,p_dia,p_culto,p_horario,p_turma,p_funcao);
$wrapper$;
revoke all on function public.kids_publicar_escala_turma(uuid,date,text,time,uuid,text) from public,anon,authenticated;
grant execute on function public.kids_publicar_escala_turma(uuid,date,text,time,uuid,text) to authenticated;

grant execute on function private.kids_convite_familia_valido(text) to anon;
-- Novas funções no esquema privado não herdam EXECUTE de PUBLIC por padrão.
alter default privileges in schema private revoke execute on functions from public;
