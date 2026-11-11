-- PROPOSTA PARA QA: não aplicada ao projeto de produção.
-- Limite parametrizado por finalidade para não bloquear voluntários no mesmo Wi-Fi.
-- A API pública NÃO recebe EXECUTE; só a Edge Function com service_role.
create or replace function public.limitar_cadastro(p_chave text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare n integer;
begin
 if p_chave !~ '^[0-9a-f]{64}$' or p_max not between 1 and 300 then return false; end if;
 insert into private.limites_cadastro as atual(chave,janela,tentativas)
 values(p_chave,now(),1)
 on conflict(chave) do update set
  tentativas=case when atual.janela<now()-interval '1 hour' then 1 else atual.tentativas+1 end,
  janela=case when atual.janela<now()-interval '1 hour' then now() else atual.janela end
 returning tentativas into n;
 return n<=p_max;
end $$;
revoke all on function public.limitar_cadastro(text,integer) from public,anon,authenticated;
grant execute on function public.limitar_cadastro(text,integer) to service_role;


-- Exclusivo do QA. Limpa limites de testes, não existe na produção.
-- A migration só pode ser aplicada a projeto com REF diferente do projeto de produção.
create or replace function public.qa_limpar_limites()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare total integer;
begin
 delete from private.limites_cadastro;
 get diagnostics total = row_count;
 return total;
end $$;
revoke all on function public.qa_limpar_limites() from public,anon,authenticated;
grant execute on function public.qa_limpar_limites() to service_role;
