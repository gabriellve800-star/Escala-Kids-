-- Exclusivo do projeto Supabase QA. A produção não deve aplicar esta migration.
create or replace function public.qa_limpar_limites()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare total integer;
begin
  delete from private.limites_cadastro where chave is not null;
  get diagnostics total = row_count;
  return total;
end $$;
revoke all on function public.qa_limpar_limites() from public,anon,authenticated;
grant execute on function public.qa_limpar_limites() to service_role;
