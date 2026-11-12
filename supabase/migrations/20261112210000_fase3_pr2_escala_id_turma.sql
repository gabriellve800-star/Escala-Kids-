-- Fase 3 PR2: publicacao de escala e mapeamento para turma UUID atomicamente.
-- Nunca inferir acesso por comparacao textual de nomes.
begin;
create or replace function public.kids_publicar_escala_turma(
  p_pessoa uuid,p_dia date,p_culto text,p_horario time,
  p_turma uuid,p_funcao text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare nome_turma text; id_escala uuid;
begin
  if not ((select private.admin_ativo()) or (select private.lider_ativo()))
     then raise exception 'SEM_PERMISSAO';end if;
  if p_pessoa is null or p_dia is null or p_dia<(now() at time zone 'America/Sao_Paulo')::date
     or p_culto not in ('domingo_manha','domingo_noite','quarta_noite')
     or p_funcao not in ('professor','auxiliar','lanche','portaria')
     or p_horario is null then raise exception 'DADOS_INVALIDOS';end if;
  if not (
    (extract(isodow from p_dia)=7 and p_culto in ('domingo_manha','domingo_noite'))
    or (extract(isodow from p_dia)=3 and p_culto='quarta_noite')
  ) then raise exception 'DATA_CULTO_INVALIDOS';end if;
  select t.nome into nome_turma from public.turmas_kids t
    where t.id=p_turma and t.ativa;
  if nome_turma is null then raise exception 'TURMA_INVALIDA';end if;
  if not exists(select 1 from public.perfis p
      where p.id=p_pessoa and p.status='ativo' and not p.primeiro_acesso)
    then raise exception 'VOLUNTARIO_INVALIDO';end if;
  insert into public.escalas(pessoa_id,dia,culto,horario,turma,funcao)
  values(p_pessoa,p_dia,p_culto,p_horario,nome_turma,p_funcao)
  on conflict(pessoa_id,dia,culto) do update set
    horario=excluded.horario,turma=excluded.turma,funcao=excluded.funcao
  returning id into id_escala;
  insert into public.escalas_turmas_kids(escala_id,turma_id,vinculada_por)
  values(id_escala,p_turma,(select auth.uid()))
  on conflict(escala_id) do update
    set turma_id=excluded.turma_id,vinculada_por=excluded.vinculada_por,vinculada_em=now();
  return id_escala;
end $$;
revoke all on function public.kids_publicar_escala_turma(uuid,date,text,time,uuid,text)
  from public,anon,authenticated;
grant execute on function public.kids_publicar_escala_turma(uuid,date,text,time,uuid,text)
  to authenticated;
commit;
