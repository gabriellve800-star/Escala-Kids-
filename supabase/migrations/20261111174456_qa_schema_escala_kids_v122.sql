-- ESQUEMA EXCLUSIVO PARA SUPABASE TESTE (QA) — NÃO APLICAR NA PRODUÇÃO.
-- Origem: tabelas, políticas e definições de funções lidas do projeto de produção em 11/11/2026.
-- Destino protegido pelo workflow: a referência não pode ser a do projeto de produção.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.perfis (
  id uuid primary key references auth.users(id) on delete restrict,
  usuario text not null unique check (usuario ~ '^[a-z][a-z0-9._-]{2,25}$' and usuario = lower(usuario)),
  nome text not null check (length(trim(nome)) between 3 and 120),
  telefone text check (telefone ~ '^\+?[0-9]{10,15}$'),
  perfil text not null default 'voluntario' check (perfil in ('administrador','lider','voluntario')),
  pode_aprovar boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente','ativo','recusado','desativado')),
  primeiro_acesso boolean not null default false,
  criado_em timestamptz not null default now(),
  aprovado_por uuid references auth.users(id) on delete restrict,
  aprovado_em timestamptz,
  constraint permissao_somente_lider check (not pode_aprovar or perfil='lider'),
  constraint telefone_exigido_voluntarios check (telefone is not null or perfil='administrador')
);
create table public.funcoes_pessoa(
  pessoa_id uuid not null references public.perfis(id) on delete restrict,
  funcao text not null check (funcao in ('professor','auxiliar','lanche','portaria')),
  primary key(pessoa_id,funcao)
);
create table public.convites(
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null unique check (codigo_hash ~ '^[0-9a-f]{64}$'),
  codigo_curto_hash text,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usos_max integer not null check (usos_max between 1 and 50),
  usos integer not null default 0 check (usos >= 0 and usos <= usos_max),
  revogado boolean not null default false
);
create table public.auditoria(
 id bigint generated always as identity primary key,
 quem uuid references auth.users(id) on delete restrict,
 acao text not null,
 alvo uuid,
 detalhes jsonb not null default '{}'::jsonb,
 quando timestamptz not null default now()
);
create table private.limites_cadastro(
 chave text primary key check (chave ~ '^[0-9a-f]{64}$'),
 janela timestamptz not null default now(),
 tentativas integer not null default 0
);
revoke all on private.limites_cadastro from public,anon,authenticated;
create index idx_perfis_status on public.perfis(status,criado_em);
create index idx_perfis_perfil on public.perfis(perfil,status);
create index idx_perfis_aprovado_por on public.perfis(aprovado_por);
create index idx_convites_ativos on public.convites(expira_em,revogado);
create index idx_convites_criado_por on public.convites(criado_por);
create unique index convites_codigo_curto_hash_uniq on public.convites(codigo_curto_hash) where codigo_curto_hash is not null;
create index idx_auditoria_tempo on public.auditoria(quando desc);
create index idx_auditoria_alvo on public.auditoria(alvo,quando desc);
create index idx_auditoria_quem on public.auditoria(quem);

-- Funções reproduzidas integralmente a partir de pg_get_functiondef.

-- private.admin_ativo()
CREATE OR REPLACE FUNCTION private.admin_ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and p.perfil='administrador' and not p.primeiro_acesso);
$function$
;

-- private.ativo()
CREATE OR REPLACE FUNCTION private.ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and not p.primeiro_acesso);
$function$
;

-- private.lider_ativo()
CREATE OR REPLACE FUNCTION private.lider_ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and p.perfil='lider' and not p.primeiro_acesso);
$function$
;

-- private.pode_aprovar()
CREATE OR REPLACE FUNCTION private.pode_aprovar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and not p.primeiro_acesso
 and (p.perfil='administrador' or (p.perfil='lider' and p.pode_aprovar)));
$function$
;

-- public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text)
CREATE OR REPLACE FUNCTION public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.perfis%rowtype; novo uuid;
begin
 select * into v from public.perfis where id=p_ator for share;
 if not found or v.status<>'ativo' or v.primeiro_acesso or not
 (v.perfil='administrador' or (v.perfil='lider' and v.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if p_codigo_hash !~ '^[0-9a-f]{64}$' or p_codigo_curto_hash !~ '^[0-9a-f]{64}$'
  or p_dias not between 1 and 30 or p_usos_max not between 1 and 50 then
  raise exception 'PARAMETROS_INVALIDOS';
 end if;
 insert into public.convites(codigo_hash,codigo_curto_hash,criado_por,expira_em,usos_max)
 values(p_codigo_hash,p_codigo_curto_hash,p_ator,now()+make_interval(days=>p_dias),p_usos_max)
 returning id into novo;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,'convite_criado',novo,jsonb_build_object('dias',p_dias,'usos_max',p_usos_max,'codigo_curto',true));
 return novo;
end $function$
;

-- public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer)
CREATE OR REPLACE FUNCTION public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.perfis%rowtype; novo uuid;
begin
 select * into v from public.perfis where id=p_ator for share;
 if not found or v.status<>'ativo' or v.primeiro_acesso or not
 (v.perfil='administrador' or (v.perfil='lider' and v.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if p_codigo_hash !~ '^[0-9a-f]{64}$' or p_dias not between 1 and 30 or p_usos_max not between 1 and 50 then
  raise exception 'PARAMETROS_INVALIDOS';
 end if;
 insert into public.convites(codigo_hash,criado_por,expira_em,usos_max)
 values(p_codigo_hash,p_ator,now()+make_interval(days=>p_dias),p_usos_max)
 returning id into novo;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,'convite_criado',novo,jsonb_build_object('dias',p_dias,'usos_max',p_usos_max));
 return novo;
end $function$
;

-- public.finalizar_cadastro(p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text)
CREATE OR REPLACE FUNCTION public.finalizar_cadastro(p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.convites%rowtype; v_hash text;
begin
 v_hash:=encode(extensions.digest(p_codigo,'sha256'),'hex');
 select * into v from public.convites
 where codigo_hash=v_hash or codigo_curto_hash=v_hash for update;
 if not found or v.revogado or v.expira_em<=now() or v.usos>=v.usos_max then
  raise exception 'CONVITE_INVALIDO';
 end if;
 insert into public.perfis(id,usuario,nome,telefone,status,perfil)
 values(p_id,p_usuario,p_nome,p_telefone,'pendente','voluntario');
 update public.convites set usos=usos+1 where id=v.id;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_id,'cadastro_pendente',p_id,jsonb_build_object('convite_id',v.id));
end $function$
;

-- public.finalizar_primeiro_acesso(p_pessoa uuid)
CREATE OR REPLACE FUNCTION public.finalizar_primeiro_acesso(p_pessoa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 update public.perfis set primeiro_acesso=false where id=p_pessoa and primeiro_acesso=true;
 if not found then raise exception 'TROCA_NAO_NECESSARIA'; end if;
 insert into public.auditoria(quem,acao,alvo) values(p_pessoa,'senha_inicial_trocada',p_pessoa);
end $function$
;

-- public.gerir_pessoa(p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text)
CREATE OR REPLACE FUNCTION public.gerir_pessoa(p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ator public.perfis%rowtype;alvo public.perfis%rowtype;
begin
 select * into ator from public.perfis where id=p_ator for share;
 select * into alvo from public.perfis where id=p_pessoa for update;
 if ator.id is null or ator.status<>'ativo' or ator.primeiro_acesso or ator.perfil<>'administrador' then
  raise exception 'SEM_PERMISSAO';
 end if;
 if alvo.id is null or alvo.status not in ('ativo','desativado') or
  p_perfil not in ('administrador','lider','voluntario') or
  p_status not in ('ativo','desativado') or
  (p_pode_aprovar and p_perfil<>'lider') or
  exists(select 1 from unnest(coalesce(p_funcoes,'{}'::text[])) x
   where x not in ('professor','auxiliar','lanche','portaria')) then
  raise exception 'ALTERACAO_INVALIDA';
 end if;
 if p_ator=p_pessoa and (p_perfil<>'administrador' or p_status<>'ativo') then
  raise exception 'NAO_ALTERAR_PROPRIA_ADMINISTRACAO';
 end if;
 if alvo.perfil='administrador' and (p_perfil<>'administrador' or p_status<>'ativo')
  and (select count(*) from public.perfis where perfil='administrador' and status='ativo')<=1 then
   raise exception 'PRESERVAR_ADMINISTRADOR';
 end if;
 update public.perfis set perfil=p_perfil,pode_aprovar=p_pode_aprovar,status=p_status where id=p_pessoa;
 delete from public.funcoes_pessoa where pessoa_id=p_pessoa;
 insert into public.funcoes_pessoa(pessoa_id,funcao)
 select p_pessoa,x from (select distinct unnest(coalesce(p_funcoes,'{}'::text[])) x) q;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,'pessoa_atualizada',p_pessoa,
 jsonb_build_object('perfil_anterior',alvo.perfil,'perfil_novo',p_perfil,
 'status_anterior',alvo.status,'status_novo',p_status,'pode_aprovar',p_pode_aprovar));
end $function$
;

-- public.limitar_cadastro(p_chave text)
CREATE OR REPLACE FUNCTION public.limitar_cadastro(p_chave text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if p_chave !~ '^[0-9a-f]{64}$' then return false; end if;
 insert into private.limites_cadastro as atual(chave,janela,tentativas)
 values(p_chave,now(),1)
 on conflict(chave) do update set
 tentativas=case when atual.janela<now()-interval '1 hour' then 1 else atual.tentativas+1 end,
 janela=case when atual.janela<now()-interval '1 hour' then now() else atual.janela end
 returning tentativas into n;
 return n<=20;
end $function$
;

-- public.revisar_cadastro(p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean)
CREATE OR REPLACE FUNCTION public.revisar_cadastro(p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text DEFAULT 'voluntario'::text, p_funcoes text[] DEFAULT '{}'::text[], p_pode_aprovar boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ator public.perfis%rowtype; alvo public.perfis%rowtype;
begin
 select * into ator from public.perfis where id=p_ator for share;
 select * into alvo from public.perfis where id=p_pessoa for update;
 if ator.id is null or ator.status<>'ativo' or ator.primeiro_acesso or not
 (ator.perfil='administrador' or (ator.perfil='lider' and ator.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if alvo.id is null or alvo.status<>'pendente' then raise exception 'CADASTRO_NAO_PENDENTE'; end if;
 if p_aprovar then
  if p_perfil not in ('administrador','lider','voluntario') or
  (p_perfil='administrador' and ator.perfil<>'administrador') or
  (p_pode_aprovar and (p_perfil<>'lider' or ator.perfil<>'administrador')) or
  exists (select 1 from unnest(coalesce(p_funcoes,'{}'::text[])) x
   where x not in ('professor','auxiliar','lanche','portaria')) then
   raise exception 'PERFIL_OU_FUNCOES_INVALIDOS';
  end if;
  update public.perfis set status='ativo',perfil=p_perfil,pode_aprovar=p_pode_aprovar,aprovado_por=p_ator,aprovado_em=now()
    where id=p_pessoa;
  insert into public.funcoes_pessoa(pessoa_id,funcao)
    select p_pessoa,x from (select distinct unnest(coalesce(p_funcoes,'{}'::text[])) x) q;
 else
  update public.perfis set status='recusado',aprovado_por=p_ator,aprovado_em=now()
   where id=p_pessoa;
 end if;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,case when p_aprovar then 'cadastro_aprovado' else 'cadastro_recusado' end,
 p_pessoa,jsonb_build_object('perfil',case when p_aprovar then p_perfil else null end));
end $function$
;

-- public.revogar_convite(p_ator uuid, p_convite uuid)
CREATE OR REPLACE FUNCTION public.revogar_convite(p_ator uuid, p_convite uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.perfis%rowtype;c public.convites%rowtype;
begin
 select * into a from public.perfis where id=p_ator for share;
 select * into c from public.convites where id=p_convite for update;
 if a.id is null or a.status<>'ativo' or a.primeiro_acesso or not
 (a.perfil='administrador' or (a.perfil='lider' and a.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if c.id is null then raise exception 'CONVITE_NAO_ENCONTRADO'; end if;
 update public.convites set revogado=true where id=p_convite;
 insert into public.auditoria(quem,acao,alvo) values(p_ator,'convite_revogado',p_convite);
end $function$
;

-- RLS sempre habilitado para schemas expostos.
alter table public.perfis enable row level security;
alter table public.convites enable row level security;
alter table public.funcoes_pessoa enable row level security;
alter table public.auditoria enable row level security;
create policy "auditoria_admin" on public.auditoria for select to authenticated using (( SELECT private.admin_ativo() AS admin_ativo));
create policy "convites_leitura_autorizada" on public.convites for select to authenticated using (( SELECT private.pode_aprovar() AS pode_aprovar));
create policy "funcoes_leitura_restrita" on public.funcoes_pessoa for select to authenticated using ((( SELECT private.ativo() AS ativo) AND ((pessoa_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.lider_ativo() AS lider_ativo) OR ( SELECT private.admin_ativo() AS admin_ativo))));
create policy "perfis_leitura_restrita" on public.perfis for select to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.admin_ativo() AS admin_ativo) OR (( SELECT private.lider_ativo() AS lider_ativo) AND (status = 'ativo'::text)) OR (( SELECT private.pode_aprovar() AS pode_aprovar) AND (status = 'pendente'::text))));

revoke all on public.perfis,public.convites,public.funcoes_pessoa,public.auditoria from anon,authenticated;
grant select on public.perfis,public.convites,public.funcoes_pessoa,public.auditoria to authenticated;
revoke all on function private.admin_ativo() from public,anon,authenticated;
grant execute on function private.admin_ativo() to authenticated;
revoke all on function private.ativo() from public,anon,authenticated;
grant execute on function private.ativo() to authenticated;
revoke all on function private.lider_ativo() from public,anon,authenticated;
grant execute on function private.lider_ativo() to authenticated;
revoke all on function private.pode_aprovar() from public,anon,authenticated;
grant execute on function private.pode_aprovar() to authenticated;
revoke all on function public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text) from public,anon,authenticated;
grant execute on function public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text) to service_role;
revoke all on function public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer) from public,anon,authenticated;
grant execute on function public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer) to service_role;
revoke all on function public.finalizar_cadastro(p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text) from public,anon,authenticated;
grant execute on function public.finalizar_cadastro(p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text) to service_role;
revoke all on function public.finalizar_primeiro_acesso(p_pessoa uuid) from public,anon,authenticated;
grant execute on function public.finalizar_primeiro_acesso(p_pessoa uuid) to service_role;
revoke all on function public.gerir_pessoa(p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text) from public,anon,authenticated;
grant execute on function public.gerir_pessoa(p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text) to service_role;
revoke all on function public.limitar_cadastro(p_chave text) from public,anon,authenticated;
grant execute on function public.limitar_cadastro(p_chave text) to service_role;
revoke all on function public.revisar_cadastro(p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean) from public,anon,authenticated;
grant execute on function public.revisar_cadastro(p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean) to service_role;
revoke all on function public.revogar_convite(p_ator uuid, p_convite uuid) from public,anon,authenticated;
grant execute on function public.revogar_convite(p_ator uuid, p_convite uuid) to service_role;
