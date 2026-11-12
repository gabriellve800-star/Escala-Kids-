-- PR2: corrigir resolucao de id em policy e impedir comparacao com v.id.
begin;
create or replace function private.pode_ver_pendente_kids(p_crianca uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select private.familia_ativa() and exists(
    select 1 from public.criancas_kids c
    join public.vinculos_kids v on v.crianca_id=c.id
    where c.id=p_crianca and c.origem='equipe' and c.status='consentimento_pendente'
      and v.responsavel_id=(select auth.uid()) and v.status='pendente'
  );
$$;
revoke all on function private.pode_ver_pendente_kids(uuid) from public,anon,authenticated;
grant execute on function private.pode_ver_pendente_kids(uuid) to authenticated;
drop policy if exists criancas_ler on public.criancas_kids;
create policy criancas_ler on public.criancas_kids for select to authenticated
using(private.pode_ver_crianca_kids(id) or private.pode_ver_pendente_kids(id));
commit;
