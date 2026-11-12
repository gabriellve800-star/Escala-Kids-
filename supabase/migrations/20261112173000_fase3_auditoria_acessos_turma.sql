-- Fase 3 PR1: auditar mudancas que podem conferir acesso a turma infantil.
begin;
create or replace function private.auditar_acessos_turma_kids()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare registro uuid; categoria text;
begin
  if TG_TABLE_NAME='coberturas_kids' then
    categoria='cobertura_temporaria';
    if TG_OP='DELETE' then registro=old.id; else registro=new.id; end if;
  else
    categoria='vinculo_escala_turma';
    if TG_OP='DELETE' then registro=old.escala_id; else registro=new.escala_id; end if;
  end if;
  insert into public.auditoria(quem,acao,alvo,detalhes)
  values((select auth.uid()),'fase3_'||lower(TG_OP),registro,
         pg_catalog.jsonb_build_object('tipo',categoria));
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
create trigger tr_coberturas_kids_audit
  after insert or delete on public.coberturas_kids
  for each row execute function private.auditar_acessos_turma_kids();
create trigger tr_escalas_turmas_kids_audit
  after insert or update or delete on public.escalas_turmas_kids
  for each row execute function private.auditar_acessos_turma_kids();
revoke all on function private.auditar_acessos_turma_kids() from public,anon,authenticated;
commit;
