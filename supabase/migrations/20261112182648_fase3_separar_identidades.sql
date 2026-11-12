-- Fase 3: defesa transacional contra contas que se tornem familia E equipe.
-- Guards aditivos no INSERT; cadastro antigo continua igual para equipe.
create or replace function private.nao_misturar_identidades_kids()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare identificador uuid;
begin
  if TG_TABLE_NAME='perfis' then
    identificador=new.id;
  else
    identificador=new.usuario_id;
  end if;
  -- Evita corrida entre dois cadastros simultaneos do mesmo usuario.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(identificador::text,0)
  );
  if TG_TABLE_NAME='perfis' then
    if exists(select 1 from public.familias_kids f where f.usuario_id=identificador) then
      raise exception 'IDENTIDADE_SEPARADA_NECESSARIA';
    end if;
  elsif exists(select 1 from public.perfis p where p.id=identificador) then
    raise exception 'IDENTIDADE_SEPARADA_NECESSARIA';
  end if;
  return new;
end $$;
create trigger trg_kids_separar_perfil_equipe
  before insert or update of id on public.perfis
  for each row execute function private.nao_misturar_identidades_kids();
create trigger trg_kids_separar_perfil_familia
  before insert or update of usuario_id on public.familias_kids
  for each row execute function private.nao_misturar_identidades_kids();
revoke all on function private.nao_misturar_identidades_kids() from public,anon,authenticated;
