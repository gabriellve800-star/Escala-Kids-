-- Escala Kids v1.2.7 — rascunho compartilhado / aprovação ATÔMICA de escala.
-- Apenas IDs de equipe e turmas; nada de fichas de crianças ou saúde.
-- Apenas "Teste escala" até validação explícita do proprietário.
begin;

create table private.rascunhos_escala_kids (
  mes date primary key,
  itens jsonb not null,
  versao integer not null default 1 check(versao between 1 and 999999),
  estado text not null default 'rascunho' check(estado in ('rascunho','aprovado')),
  atualizado_por uuid not null references public.perfis(id) on delete restrict,
  atualizado_em timestamptz not null default now(),
  aprovado_por uuid references public.perfis(id) on delete restrict,
  aprovado_em timestamptz,
  check(date_trunc('month',mes::timestamp)::date=mes)
);
alter table private.rascunhos_escala_kids enable row level security;
revoke all on private.rascunhos_escala_kids from public,anon,authenticated;
create policy rascunho_escala_privado on private.rascunhos_escala_kids
  for all to public using(false) with check(false);

create or replace function private.kids_pode_planejar()
returns boolean language sql stable security definer set search_path=''
as $$
 select private.equipe_ativa() and (
  private.admin_ativo() or private.lider_ativo()
  or private.tem_permissao_kids('montar_escalas')
  or private.tem_permissao_kids('aprovar_escalas')
 );
$$;
create or replace function private.kids_pode_aprovar_escala()
returns boolean language sql stable security definer set search_path=''
as $$
 select private.equipe_ativa() and (
  private.admin_ativo() or private.lider_ativo()
  or private.tem_permissao_kids('aprovar_escalas')
 );
$$;

-- Retorna SOMENTE nome/ID/funções da equipe; jamais telefone, e-mail,
-- contatos familiares, dados de crianças ou campos de saúde.
create or replace function private.kids_planejamento_base(p_mes date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare resultado jsonb;
begin
 if not private.kids_pode_planejar() then raise exception 'SEM_PERMISSAO'; end if;
 if p_mes is distinct from
  date_trunc('month',(now() at time zone 'America/Sao_Paulo') + interval '1 month')::date
  then raise exception 'MES_INVALIDO';end if;
 select jsonb_build_object(
   'mes',p_mes,
   'pode_editar',private.kids_pode_planejar(),
   'pode_aprovar',private.kids_pode_aprovar_escala(),
   'turmas',coalesce((select jsonb_agg(jsonb_build_object(
     'id',t.id,'posicao',t.posicao,'nome',t.nome,'ativa',t.ativa) order by t.posicao)
     from public.turmas_kids t), '[]'::jsonb),
   'equipe',coalesce((select jsonb_agg(jsonb_build_object(
     'id',p.id,'nome',p.nome,'funcoes',
       coalesce((select jsonb_agg(f.funcao order by f.funcao)
             from public.funcoes_pessoa f where f.pessoa_id=p.id),'[]'::jsonb))
        order by p.nome,p.id)
     from public.perfis p where p.status='ativo' and not p.primeiro_acesso
       and not exists(select 1 from public.familias_kids fam where fam.usuario_id=p.id)
    ),'[]'::jsonb),
   'disponibilidades',coalesce((select jsonb_agg(jsonb_build_object(
     'pessoa_id',d.pessoa_id,'dia',d.dia,'culto',d.culto) order by d.dia,d.culto,d.pessoa_id)
     from public.disponibilidades d
       where d.dia>=p_mes and d.dia<(p_mes+interval '1 month')::date
    ),'[]'::jsonb),
   'publicadas',coalesce((select jsonb_agg(jsonb_build_object(
     'pessoa_id',e.pessoa_id,'dia',e.dia,'culto',e.culto,
     'funcao',e.funcao,'turma_id',m.turma_id,'turma',e.turma,'horario',e.horario
     ) order by e.dia,e.culto,e.funcao,e.pessoa_id)
     from public.escalas e left join public.escalas_turmas_kids m on m.escala_id=e.id
     where e.dia>=p_mes and e.dia<(p_mes+interval '1 month')::date
    ),'[]'::jsonb),
   'rascunho',(select jsonb_build_object(
     'itens',r.itens,'versao',r.versao,'estado',r.estado,
     'atualizado_em',r.atualizado_em,'aprovado_em',r.aprovado_em)
     from private.rascunhos_escala_kids r where r.mes=p_mes)
 ) into resultado;
 return resultado;
end $$;

create or replace function private.kids_validar_sugestao(
  p_mes date,p_itens jsonb,p_final boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare
  elem jsonb; dia date; culto text; funcao text; turma_id uuid;
  pessoa uuid; horario text; chave text;
  chaves text[]:=array[]::text[]; ocupacoes text[]:=array[]::text[];
  total int; esperado int; cultos_do_mes int; quantidade_turmas int;
begin
 if p_mes is distinct from date_trunc('month',
   (now() at time zone 'America/Sao_Paulo') + interval '1 month')::date
   then raise exception 'MES_INVALIDO';end if;
 if jsonb_typeof(p_itens) is distinct from 'array'
   then raise exception 'RASCUNHO_INVALIDO';end if;
 total=jsonb_array_length(p_itens);
 select count(*) into quantidade_turmas from public.turmas_kids where ativa;
 if quantidade_turmas<>4 then raise exception 'CONFIGURE_QUATRO_TURMAS';end if;
 select count(*) into cultos_do_mes
 from generate_series(p_mes::timestamp,
    (p_mes+interval '1 month'-interval '1 day')::timestamp,interval '1 day') d
 where extract(isodow from d)=3 or extract(isodow from d)=7;
 select count(*) + count(*) filter(where extract(isodow from d)=7)
   into cultos_do_mes
 from generate_series(p_mes::timestamp,
    (p_mes+interval '1 month'-interval '1 day')::timestamp,interval '1 day') d
 where extract(isodow from d) in (3,7);
 esperado=cultos_do_mes*(quantidade_turmas*2+2);
 if total<>esperado or total>320 then raise exception 'QUANTIDADE_DE_VAGAS_INVALIDA';end if;

 for elem in select value from jsonb_array_elements(p_itens)
 loop
   if jsonb_typeof(elem) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(elem) k
       where k not in ('dia','culto','funcao','turma_id','pessoa_id','horario'))
     then raise exception 'CAMPOS_INDEVIDOS';end if;
   if coalesce(elem->>'dia','') !~ '^\d{4}-\d{2}-\d{2}$'
     then raise exception 'DATA_INVALIDA';end if;
   dia=(elem->>'dia')::date;culto=elem->>'culto';funcao=elem->>'funcao';
   if dia<p_mes or dia>=(p_mes+interval '1 month')::date
     or not ((extract(isodow from dia)=7 and culto in ('domingo_manha','domingo_noite'))
          or (extract(isodow from dia)=3 and culto='quarta_noite'))
     or funcao not in ('professor','auxiliar','portaria','lanche')
     then raise exception 'SLOT_INVALIDO';end if;
   if funcao in ('professor','auxiliar') then
     if elem->>'turma_id' is null then raise exception 'TURMA_OBRIGATORIA';end if;
     turma_id=(elem->>'turma_id')::uuid;
     if not exists(select 1 from public.turmas_kids where id=turma_id and ativa)
       then raise exception 'TURMA_INVALIDA';end if;
   else
     if elem->>'turma_id' is not null then raise exception 'CARGO_SEM_TURMA';end if;
     turma_id=null;
   end if;
   chave=dia::text||'|'||culto||'|'||funcao||'|'||coalesce(turma_id::text,'-');
   if chave=any(chaves) then raise exception 'VAGA_REPETIDA';end if;
   chaves=array_append(chaves,chave);

   pessoa=nullif(elem->>'pessoa_id','')::uuid;
   horario=nullif(elem->>'horario','');
   if horario is not null and horario !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then raise exception 'HORARIO_INVALIDO';end if;
   if pessoa is not null then
     if not exists(select 1 from public.perfis p
       join public.funcoes_pessoa f on f.pessoa_id=p.id and f.funcao=funcao
       join public.disponibilidades v on v.pessoa_id=p.id and v.dia=dia and v.culto=culto
       where p.id=pessoa and p.status='ativo' and not p.primeiro_acesso)
       then raise exception 'VOLUNTARIO_INDISPONIVEL_OU_SEM_FUNCAO';end if;
     chave=dia::text||'|'||culto||'|'||pessoa::text;
     if chave=any(ocupacoes) then raise exception 'VOLUNTARIO_DUPLICADO_NO_CULTO';end if;
     ocupacoes=array_append(ocupacoes,chave);
     if p_final and horario is null then raise exception 'HORARIO_OBRIGATORIO';end if;
     if exists(select 1 from public.escalas e
      where e.pessoa_id=pessoa and e.dia=dia and e.culto=culto)
       then raise exception 'VOLUNTARIO_JA_PUBLICADO';end if;
   elsif p_final then
     -- Só permite vaga em branco se já estiver ocupada por escala publicada.
     if not exists(
       select 1 from public.escalas e
       left join public.escalas_turmas_kids m on m.escala_id=e.id
       where e.dia=dia and e.culto=culto and e.funcao=funcao
       and (
         (turma_id is not null and (m.turma_id=turma_id or
           (m.turma_id is null and lower(btrim(e.turma))=
             (select lower(btrim(t.nome)) from public.turmas_kids t where t.id=turma_id))))
         or (turma_id is null and
           ((funcao='portaria' and e.turma='Portaria') or
            (funcao='lanche' and e.turma in ('Cozinha','Lanche'))))
       )
     ) then raise exception 'VAGAS_SEM_EQUIPE';end if;
   end if;
   -- Impede adicionar uma SEGUNDA pessoa à mesma vaga já publicada.
   if pessoa is not null and exists(
     select 1 from public.escalas e
     left join public.escalas_turmas_kids m on m.escala_id=e.id
     where e.dia=dia and e.culto=culto and e.funcao=funcao
       and (
         (turma_id is not null and (m.turma_id=turma_id or
          (m.turma_id is null and lower(btrim(e.turma))=
            (select lower(btrim(t.nome)) from public.turmas_kids t where t.id=turma_id))))
         or (turma_id is null and
            ((funcao='portaria' and e.turma='Portaria') or
             (funcao='lanche' and e.turma in ('Cozinha','Lanche'))))
       )
   ) then raise exception 'VAGA_JA_PUBLICADA';end if;
 end loop;
end $$;

create or replace function private.kids_salvar_sugestao(
  p_mes date,p_itens jsonb,p_versao integer default null)
returns integer language plpgsql security definer set search_path=''
as $$
declare nova integer;
begin
 if not private.kids_pode_planejar() then raise exception 'SEM_PERMISSAO';end if;
 perform private.kids_validar_sugestao(p_mes,p_itens,false);
 insert into private.rascunhos_escala_kids(mes,itens,atualizado_por)
   values(p_mes,p_itens,(select auth.uid()))
   on conflict(mes) do update
     set itens=excluded.itens,versao=private.rascunhos_escala_kids.versao+1,
         atualizado_por=excluded.atualizado_por,atualizado_em=now()
    where private.rascunhos_escala_kids.estado='rascunho'
      and private.rascunhos_escala_kids.versao=p_versao
 returning versao into nova;
 if nova is null then raise exception 'RASCUNHO_DESATUALIZADO_OU_APROVADO';end if;
 insert into public.auditoria(quem,acao,detalhes)
   values((select auth.uid()),'kids_escala_sugerida_salva',
     jsonb_build_object('mes',p_mes,'versao',nova));
 return nova;
end $$;

create or replace function private.kids_aprovar_sugestao(p_mes date,p_versao integer)
returns integer language plpgsql security definer set search_path=''
as $$
declare registro record; elem jsonb; pessoa uuid; turma uuid; funcao text;
  dia date; culto text; horario time; nome text; total integer:=0; novo_id uuid;
begin
 if not private.kids_pode_aprovar_escala() then raise exception 'SEM_PERMISSAO';end if;
 -- Trava as aprovações concorrentes do mês durante a transação.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kids-escala-'||p_mes::text,0));
 select * into registro from private.rascunhos_escala_kids
  where mes=p_mes and estado='rascunho' and versao=p_versao for update;
 if not found then raise exception 'RASCUNHO_DESATUALIZADO_OU_APROVADO';end if;
 perform private.kids_validar_sugestao(p_mes,registro.itens,true);
 for elem in select value from jsonb_array_elements(registro.itens)
 loop
   pessoa=nullif(elem->>'pessoa_id','')::uuid;
   if pessoa is null then continue;end if;
   turma=nullif(elem->>'turma_id','')::uuid;
   funcao=elem->>'funcao';dia=(elem->>'dia')::date;
   culto=elem->>'culto';horario=(elem->>'horario')::time;
   if turma is not null then
     select t.nome into nome from public.turmas_kids t where t.id=turma and t.ativa;
   elsif funcao='portaria' then nome='Portaria';
   else nome='Cozinha';end if;
   insert into public.escalas(pessoa_id,dia,culto,horario,turma,funcao)
      values(pessoa,dia,culto,horario,nome,funcao) returning id into novo_id;
   if turma is not null then
     insert into public.escalas_turmas_kids(escala_id,turma_id,vinculada_por)
       values(novo_id,turma,(select auth.uid()));
   end if;
   total=total+1;
 end loop;
 update private.rascunhos_escala_kids
   set estado='aprovado',aprovado_por=(select auth.uid()),aprovado_em=now()
   where mes=p_mes;
 insert into public.auditoria(quem,acao,detalhes)
   values((select auth.uid()),'kids_escala_sugerida_aprovada',
      jsonb_build_object('mes',p_mes,'quantidade',total));
 return total;
end $$;

-- Somente wrappers INVOKER ficam expostos na API pública (PostgREST).
create function public.kids_planejamento_base(p_mes date)
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.kids_planejamento_base(p_mes); $$;
create function public.kids_salvar_sugestao(p_mes date,p_itens jsonb,p_versao integer default null)
returns integer language sql volatile security invoker set search_path=''
as $$ select private.kids_salvar_sugestao(p_mes,p_itens,p_versao); $$;
create function public.kids_aprovar_sugestao(p_mes date,p_versao integer)
returns integer language sql volatile security invoker set search_path=''
as $$ select private.kids_aprovar_sugestao(p_mes,p_versao); $$;

revoke all on function public.kids_planejamento_base(date),
 public.kids_salvar_sugestao(date,jsonb,integer),
 public.kids_aprovar_sugestao(date,integer) from public,anon,authenticated;
grant execute on function public.kids_planejamento_base(date),
 public.kids_salvar_sugestao(date,jsonb,integer),
 public.kids_aprovar_sugestao(date,integer) to authenticated;
revoke all on function private.kids_pode_planejar(),private.kids_pode_aprovar_escala(),
 private.kids_planejamento_base(date),private.kids_validar_sugestao(date,jsonb,boolean),
 private.kids_salvar_sugestao(date,jsonb,integer),
 private.kids_aprovar_sugestao(date,integer) from public,anon,authenticated;
grant execute on function private.kids_planejamento_base(date),
 private.kids_salvar_sugestao(date,jsonb,integer),
 private.kids_aprovar_sugestao(date,integer) to authenticated;
commit;
