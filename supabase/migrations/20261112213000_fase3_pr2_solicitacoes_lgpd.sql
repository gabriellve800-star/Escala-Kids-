-- PR2: direitos LGPD pertencem a qualquer familia cadastrada, inclusive pendente/desativada.
-- Nao disponibiliza dados do filho: apenas protocola pedido auditavel.
begin;
create or replace function private.kids_pedir_privacidade(p_tipo text,p_crianca uuid default null)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid());
begin
  if uid is null or not exists(select 1 from public.familias_kids f
    where f.usuario_id=uid and f.status in ('pendente','ativo','desativado'))
    or p_tipo is null or p_tipo not in ('acesso','correcao','exclusao','revogacao')
    then raise exception 'SEM_PERMISSAO';end if;
  if p_crianca is not null
    and not exists(
      select 1 from public.criancas_kids c where c.id=p_crianca
      and (
        (c.criado_por=uid and c.origem='familia')
        or exists(select 1 from public.vinculos_kids v where v.crianca_id=c.id
              and v.responsavel_id=uid and v.status in ('pendente','confirmado'))
      )
    )
    then raise exception 'SEM_PERMISSAO';end if;
  insert into public.solicitacoes_privacidade_kids(responsavel_id,crianca_id,tipo)
  values(uid,p_crianca,p_tipo);
  insert into public.auditoria(quem,acao,alvo,detalhes)
  values(uid,'kids_solicitacao_privacidade',p_crianca,
    pg_catalog.jsonb_build_object('tipo',p_tipo));
  return true;
end $$;
revoke all on function private.kids_pedir_privacidade(text,uuid) from public,anon;
grant execute on function private.kids_pedir_privacidade(text,uuid) to authenticated;
-- Visibilidade limitada: proprio pedido, sem depender do status ativo.
drop policy if exists privacidade_ler on public.solicitacoes_privacidade_kids;
create policy privacidade_ler on public.solicitacoes_privacidade_kids
for select to authenticated
using ((select private.admin_ativo()) or
  (responsavel_id=(select auth.uid()) and exists (
    select 1 from public.familias_kids f
    where f.usuario_id=(select auth.uid())
  )));
commit;
