-- PR 2 (FASE 3): cadastro familiar e infantil controlado.
-- Aplicar SOMENTE ao Supabase "Teste escala" antes de qualquer aprovação.
-- Nenhum termo ou criança é inserido nesta migration.
begin;

create table if not exists private.termos_kids (
  versao text primary key check (char_length(versao) between 1 and 48),
  texto text not null check(char_length(texto) between 100 and 30000),
  ativo boolean not null default false,
  publicado_em timestamptz not null default now()
);
create unique index if not exists uq_termo_ativo_kids on private.termos_kids(ativo) where ativo;
alter table private.termos_kids enable row level security;
revoke all on private.termos_kids from public,anon,authenticated;
create policy termo_kids_private_deny on private.termos_kids for all to public using(false) with check(false);

-- Usuário com cadastro familiar pendente pode consultar SOMENTE seus próprios dados.
drop policy if exists familia_ler_propria on public.familias_kids;
create policy familia_ler_propria on public.familias_kids for select to authenticated
using ((select private.admin_ativo()) or
  (usuario_id=(select auth.uid()) and not exists
    (select 1 from public.perfis p where p.id=usuario_id)));

-- Família vinculada vê uma ficha criada pela equipe para confirmar consentimento.
drop policy if exists criancas_ler on public.criancas_kids;
create policy criancas_ler on public.criancas_kids for select to authenticated
using(
  private.pode_ver_crianca_kids(id)
  or (origem='equipe' and status='consentimento_pendente' and private.familia_ativa()
    and exists(select 1 from public.vinculos_kids v where v.crianca_id=id
       and v.responsavel_id=(select auth.uid()) and v.status='pendente'))
);

create or replace function public.kids_termo_atual()
returns table(versao text,texto text)
language sql stable security definer set search_path=''
as $$
  select t.versao,t.texto from private.termos_kids t where t.ativo limit 1;
$$;

-- Token aleatório de 256 bits; somente hash no banco. Não confundir com convite da equipe.
create or replace function public.kids_emitir_convite_familia(p_dias integer default 7)
returns text language plpgsql security definer set search_path=''
as $$
declare codigo text;
begin
  if not ((select private.pode_aprovar()) or (select private.admin_ativo()))
    then raise exception 'SEM_PERMISSAO'; end if;
  if p_dias not between 1 and 14 then raise exception 'PARAMETROS_INVALIDOS'; end if;
  codigo=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.convites_familia_kids(codigo_hash,criado_por,expira_em,usos_max)
  values(encode(extensions.digest(codigo,'sha256'),'hex'),(select auth.uid()),
         now()+pg_catalog.make_interval(days=>p_dias),1);
  insert into public.auditoria(quem,acao,detalhes)
    values((select auth.uid()),'kids_convite_familia_emitido','{}'::jsonb);
  return codigo;
end $$;

-- Status booleano: não retorna identidade, nome ou contato de nenhum usuário.
create or replace function public.kids_convite_familia_valido(p_codigo text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{64}$' then return false; end if;
  return exists(select 1 from private.convites_familia_kids c
    where c.codigo_hash=encode(extensions.digest(p_codigo,'sha256'),'hex')
      and not c.revogado and c.expira_em>now() and c.usos<c.usos_max);
end $$;

-- O e-mail é validado pelo próprio Supabase Auth, nunca por metadata do JWT.
-- Bloqueia identidade dupla, limita tentativas por usuário e consome convite atomicamente.
create or replace function public.kids_resgatar_convite_familia(p_codigo text,p_nome text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); confirmado timestamptz;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{64}$'
    or p_nome is null or char_length(btrim(p_nome)) not between 3 and 120
    then raise exception 'CONVITE_INDISPONIVEL'; end if;
  if not public.limitar_cadastro(
    encode(extensions.digest('resgate-familia:'||uid::text,'sha256'),'hex'),12)
    then raise exception 'TENTATIVAS_EXCEDIDAS'; end if;
  if exists(select 1 from public.perfis where id=uid)
    or exists(select 1 from public.familias_kids where usuario_id=uid)
    then raise exception 'CONVITE_INDISPONIVEL'; end if;
  select email_confirmed_at into confirmado from auth.users where id=uid;
  if confirmado is null then raise exception 'EMAIL_NAO_CONFIRMADO'; end if;
  update private.convites_familia_kids
  set usos=usos+1
  where codigo_hash=encode(extensions.digest(p_codigo,'sha256'),'hex')
    and not revogado and expira_em>now() and usos<usos_max;
  if not found then raise exception 'CONVITE_INDISPONIVEL'; end if;
  insert into public.familias_kids(usuario_id,nome,email_confirmado_em,status)
    values(uid,btrim(p_nome),confirmado,'pendente');
  insert into public.auditoria(quem,acao,alvo,detalhes)
    values(uid,'kids_familia_solicitada',uid,'{}'::jsonb);
  return true;
end $$;

create or replace function public.kids_familias_pendentes()
returns table(usuario_id uuid,nome text,status text,criado_em timestamptz)
language sql stable security definer set search_path=''
as $$
  select f.usuario_id,f.nome,f.status,f.criado_em from public.familias_kids f
  where ((select private.pode_aprovar()) or
         (select private.tem_permissao_kids('confirmar_cadastros')))
  order by f.criado_em desc limit 100;
$$;

create or replace function public.kids_aprovar_familia(p_responsavel uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if not ((select private.pode_aprovar()) or (select private.tem_permissao_kids('confirmar_cadastros')))
    then raise exception 'SEM_PERMISSAO'; end if;
  update public.familias_kids
     set status='ativo',aprovado_por=(select auth.uid()),aprovado_em=now()
   where usuario_id=p_responsavel and status='pendente' and email_confirmado_em is not null
     and not exists(select 1 from public.perfis where id=p_responsavel);
  if not found then raise exception 'OPERACAO_NAO_PERMITIDA';end if;
  insert into public.auditoria(quem,acao,alvo,detalhes)
    values((select auth.uid()),'kids_familia_aprovada',p_responsavel,'{}'::jsonb);
  return true;
end $$;

create or replace function public.kids_criar_crianca(
  p_nome text,p_nascimento date,p_turma uuid,p_versao text default null)
returns table(id uuid,numero text,status text)
language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); crianca_id uuid; origem text; est text; codigo text;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  -- Não há termo oficial fornecido: proíbe TODO cadastro, inclusive via API direta.
  if p_versao is null or not exists(
     select 1 from private.termos_kids t where t.ativo and t.versao=p_versao)
      then raise exception 'TERMO_NAO_PUBLICADO'; end if;
  if p_nome is null or char_length(btrim(p_nome)) not between 2 and 120
    or p_nascimento is null or p_nascimento>(now() at time zone 'America/Sao_Paulo')::date
    or p_nascimento<((now() at time zone 'America/Sao_Paulo')::date-interval '18 years')::date
    then raise exception 'DADOS_INVALIDOS'; end if;
  if not exists(select 1 from public.turmas_kids t where t.id=p_turma and t.ativa)
    then raise exception 'TURMA_INVALIDA';end if;
  if (select private.familia_ativa()) then
    origem='familia';est='aguardando_equipe';
  elsif (select private.admin_ativo()) or (select private.lider_ativo())
     or ((select private.tem_permissao_kids('cadastrar_criancas'))
       and private.escalada_turma_kids(p_turma)) then
    origem='equipe';est='consentimento_pendente';
  else raise exception 'SEM_PERMISSAO'; end if;
  insert into public.criancas_kids(nome,nascimento,turma_id,origem,status,criado_por)
     values(btrim(p_nome),p_nascimento,p_turma,origem,est,uid)
     returning criancas_kids.id,criancas_kids.numero into crianca_id,codigo;
  if origem='familia' then
    insert into public.vinculos_kids(crianca_id,responsavel_id,parentesco)
      values(crianca_id,uid,'Responsavel');
    insert into public.consentimentos_kids(crianca_id,responsavel_id,finalidade,versao_termo)
      values(crianca_id,uid,'cadastro',p_versao);
  end if;
  insert into public.auditoria(quem,acao,alvo,detalhes)
    values(uid,'kids_crianca_criada',crianca_id,
           pg_catalog.jsonb_build_object('origem',origem));
  return query select crianca_id,codigo,est;
end $$;

-- Associação a criança criada pela equipe não ativa a criança sem confirmação familiar.
create or replace function public.kids_vincular_responsavel(p_crianca uuid,p_responsavel uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare turma uuid;
begin
  select turma_id into turma from public.criancas_kids
  where id=p_crianca and origem='equipe' and status='consentimento_pendente' for update;
  if turma is null then raise exception 'OPERACAO_NAO_PERMITIDA';end if;
  if not ((select private.admin_ativo()) or (select private.lider_ativo())
     or ((select private.tem_permissao_kids('gerenciar_vinculos'))
       and private.escalada_turma_kids(turma)))
    then raise exception 'SEM_PERMISSAO';end if;
  if not exists(select 1 from public.familias_kids f
    where f.usuario_id=p_responsavel and f.status='ativo'
      and f.email_confirmado_em is not null)
    then raise exception 'OPERACAO_NAO_PERMITIDA';end if;
  insert into public.vinculos_kids(crianca_id,responsavel_id,parentesco)
  values(p_crianca,p_responsavel,'Responsavel');
  insert into public.auditoria(quem,acao,alvo,detalhes)
  values((select auth.uid()),'kids_vinculo_solicitado',p_crianca,'{}'::jsonb);
  return true;
end $$;

create or replace function public.kids_confirmar_filho(p_crianca uuid,p_versao text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid());
begin
  if not (select private.familia_ativa()) then raise exception 'SEM_PERMISSAO';end if;
  if not exists(select 1 from private.termos_kids where ativo and versao=p_versao)
    then raise exception 'TERMO_NAO_PUBLICADO';end if;
  perform 1 from public.criancas_kids c where c.id=p_crianca
    and c.origem='equipe' and c.status='consentimento_pendente' for update;
  if not found then raise exception 'OPERACAO_NAO_PERMITIDA';end if;
  update public.vinculos_kids set status='confirmado',confirmado_em=now()
  where crianca_id=p_crianca and responsavel_id=uid and status='pendente';
  if not found then raise exception 'SEM_PERMISSAO';end if;
  insert into public.consentimentos_kids(crianca_id,responsavel_id,finalidade,versao_termo)
  values(p_crianca,uid,'cadastro',p_versao);
  update public.criancas_kids set status='ativo',alterado_em=now() where id=p_crianca;
  insert into public.auditoria(quem,acao,alvo,detalhes)
  values(uid,'kids_filho_confirmado',p_crianca,'{}'::jsonb);
  return true;
end $$;

create or replace function public.kids_aprovar_crianca(p_crianca uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare turma uuid;
begin
  select turma_id into turma from public.criancas_kids
    where id=p_crianca and status='aguardando_equipe' and origem='familia' for update;
  if turma is null then raise exception 'OPERACAO_NAO_PERMITIDA'; end if;
  if not ((select private.admin_ativo()) or (select private.lider_ativo())
     or ((select private.tem_permissao_kids('confirmar_cadastros'))
       and private.escalada_turma_kids(turma)))
    then raise exception 'SEM_PERMISSAO';end if;
  if not exists (
    select 1 from public.vinculos_kids v
    join public.consentimentos_kids c
      on c.crianca_id=v.crianca_id and c.responsavel_id=v.responsavel_id
    join private.termos_kids t on t.versao=c.versao_termo
    where v.crianca_id=p_crianca and v.status='pendente'
      and c.finalidade='cadastro' and c.revogado_em is null and t.ativo
  ) then raise exception 'CONSENTIMENTO_PENDENTE';end if;
  update public.vinculos_kids set status='confirmado',
    confirmado_por=(select auth.uid()),confirmado_em=now()
    where crianca_id=p_crianca and status='pendente';
  update public.criancas_kids set status='ativo',alterado_em=now() where id=p_crianca;
  insert into public.auditoria(quem,acao,alvo,detalhes)
     values((select auth.uid()),'kids_crianca_aprovada',p_crianca,'{}'::jsonb);
  return true;
end $$;

create or replace function public.kids_pedir_privacidade(p_tipo text,p_crianca uuid default null)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid());
begin
  if not (select private.familia_ativa()) or p_tipo not in
    ('acesso','correcao','exclusao','revogacao') then raise exception 'SEM_PERMISSAO';end if;
  if p_crianca is not null and not private.familia_vinculada_kids(p_crianca)
    then raise exception 'SEM_PERMISSAO';end if;
  insert into public.solicitacoes_privacidade_kids(responsavel_id,crianca_id,tipo)
  values(uid,p_crianca,p_tipo);
  insert into public.auditoria(quem,acao,alvo,detalhes)
  values(uid,'kids_solicitacao_privacidade',p_crianca,
    pg_catalog.jsonb_build_object('tipo',p_tipo));
  return true;
end $$;

-- Somente funções com checagens próprias são acessíveis pelo cliente autenticado.
revoke all on function public.kids_termo_atual(),public.kids_emitir_convite_familia(integer),
 public.kids_convite_familia_valido(text),public.kids_resgatar_convite_familia(text,text),
 public.kids_familias_pendentes(),public.kids_aprovar_familia(uuid),
 public.kids_criar_crianca(text,date,uuid,text),public.kids_vincular_responsavel(uuid,uuid),
 public.kids_confirmar_filho(uuid,text),public.kids_aprovar_crianca(uuid),
 public.kids_pedir_privacidade(text,uuid)
 from public,anon,authenticated;
grant execute on function public.kids_convite_familia_valido(text) to anon,authenticated;
grant execute on function public.kids_termo_atual(),
 public.kids_emitir_convite_familia(integer),public.kids_resgatar_convite_familia(text,text),
 public.kids_familias_pendentes(),public.kids_aprovar_familia(uuid),
 public.kids_criar_crianca(text,date,uuid,text),public.kids_vincular_responsavel(uuid,uuid),
 public.kids_confirmar_filho(uuid,text),public.kids_aprovar_crianca(uuid),
 public.kids_pedir_privacidade(text,uuid)
 to authenticated;

commit;
