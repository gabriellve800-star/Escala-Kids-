-- Pilot parents/children 2026-11: class assignment requires unique age match,
-- family phone mandatory; legal term intentionally NOT created.
-- QA ONLY. Never run in production without verified approvals.
begin;

alter table public.familias_kids drop constraint if exists familias_kids_telefone_check;
alter table public.familias_kids add constraint familias_kids_telefone_check
  check(telefone is null or telefone ~ '^[0-9]{10,15}$');

-- Disable the legacy two-argument endpoint so it cannot bypass mandatory phone.
create or replace function private.kids_resgatar_convite_familia(p_codigo text,p_nome text)
returns boolean language plpgsql volatile security definer set search_path=''
as $$ begin raise exception 'ATUALIZACAO_OBRIGATORIA'; end $$;

create or replace function private.kids_resgatar_convite_familia(p_codigo text,p_nome text,p_telefone text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); confirmado timestamptz;
begin
  if uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{64}$'
    or p_nome is null or char_length(btrim(p_nome)) not between 3 and 120
    or p_telefone is null or p_telefone !~ '^[0-9]{10,15}$'
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
  insert into public.familias_kids(usuario_id,nome,telefone,email_confirmado_em,status)
    values(uid,btrim(p_nome),p_telefone,confirmado,'pendente');
  insert into public.auditoria(quem,acao,alvo,detalhes)
    values(uid,'kids_familia_solicitada',uid,'{}'::jsonb);
  return true;
end $$;

revoke all on function private.kids_resgatar_convite_familia(text,text,text)
  from public,anon,authenticated;
grant execute on function private.kids_resgatar_convite_familia(text,text,text)
  to authenticated;
create function public.kids_resgatar_convite_familia(
  p_codigo text,p_nome text,p_telefone text)
returns boolean language sql volatile security invoker set search_path=''
as $$select private.kids_resgatar_convite_familia(p_codigo,p_nome,p_telefone);$$;
revoke all on function public.kids_resgatar_convite_familia(text,text,text)
  from public,anon,authenticated;
grant execute on function public.kids_resgatar_convite_familia(text,text,text)
  to authenticated;

-- Only leaders with approval rights, ADM and individually delegated reviewers
-- may see the parent's phone; never expose the Auth email.
create function private.kids_familias_revisao()
returns table(usuario_id uuid,nome text,status text,telefone text,criado_em timestamptz)
language sql stable security definer set search_path=''
as $$
  select f.usuario_id,f.nome,f.status,f.telefone,f.criado_em
  from public.familias_kids f
  where ((select private.pode_aprovar())
    or (select private.tem_permissao_kids('confirmar_cadastros')))
  order by f.criado_em desc limit 100;
$$;
revoke all on function private.kids_familias_revisao()
  from public,anon,authenticated;
grant execute on function private.kids_familias_revisao() to authenticated;
create function public.kids_familias_revisao()
returns table(usuario_id uuid,nome text,status text,telefone text,criado_em timestamptz)
language sql stable security invoker set search_path=''
as $$select * from private.kids_familias_revisao();$$;
revoke all on function public.kids_familias_revisao()
 from public,anon,authenticated;
grant execute on function public.kids_familias_revisao() to authenticated;

-- Prevent creating overlapping age bands, even via REST API, if active.
create function private.kids_bloquear_sobreposicao_turmas()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.ativa and exists(
    select 1 from public.turmas_kids other
    where other.id<>new.id and other.ativa
      and other.idade_min_meses<=new.idade_max_meses
      and other.idade_max_meses>=new.idade_min_meses
  ) then raise exception 'FAIXAS_ETARIAS_SOBREPOSTAS';end if;
  return new;
end $$;
revoke all on function private.kids_bloquear_sobreposicao_turmas()
  from public,anon,authenticated;
create trigger trg_kids_validar_faixas_turmas
before insert or update of idade_min_meses,idade_max_meses,ativa
on public.turmas_kids for each row
execute function private.kids_bloquear_sobreposicao_turmas();

-- Replace existing private implementation, preserving its public invoker wrapper
-- and every existing check for auth, consent, team permission and audit.
create or replace function private.kids_criar_crianca(
  p_nome text,p_nascimento date,p_turma uuid,p_versao text default null,p_aceite boolean default false)
returns table(id uuid,numero text,status text)
language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); crianca_id uuid; origem text; est text; codigo text; idade_meses integer; matches bigint; sugerida uuid;
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
  idade_meses = (extract(year from pg_catalog.age(
    (now() at time zone 'America/Sao_Paulo')::date,p_nascimento))*12
     + extract(month from pg_catalog.age(
    (now() at time zone 'America/Sao_Paulo')::date,p_nascimento)))::integer;
  select count(*),(array_agg(t.id order by t.posicao))[1] into matches,sugerida
    from public.turmas_kids t
    where t.ativa and idade_meses between t.idade_min_meses and t.idade_max_meses;
  if matches=0 then raise exception 'IDADE_SEM_TURMA';end if;
  if matches>1 then raise exception 'FAIXAS_ETARIAS_SOBREPOSTAS';end if;
  if p_turma is distinct from sugerida then raise exception 'TURMA_NAO_CORRESPONDE_IDADE';end if;
  if not exists(select 1 from public.turmas_kids t where t.id=p_turma and t.ativa)
    then raise exception 'TURMA_INVALIDA';end if;
  if (select private.familia_ativa()) then
    if p_aceite is distinct from true then raise exception 'CONSENTIMENTO_OBRIGATORIO';end if;
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


-- The pastor who leads Kids may configure classes like the ADM.
-- Delegated staff only receive the specific gerenciar_turmas scope.
drop policy if exists turmas_inserir on public.turmas_kids;
drop policy if exists turmas_editar on public.turmas_kids;
create policy turmas_inserir on public.turmas_kids for insert to authenticated
  with check ((select private.lider_ativo())
    or (select private.tem_permissao_kids('gerenciar_turmas')));
create policy turmas_editar on public.turmas_kids for update to authenticated
  using ((select private.lider_ativo())
    or (select private.tem_permissao_kids('gerenciar_turmas')))
  with check ((select private.lider_ativo())
    or (select private.tem_permissao_kids('gerenciar_turmas')));

commit;
