-- Escala Kids v1.2.7: turmas FIXAS editáveis e permissões distintas de planejamento.
-- DDL aditiva, sem dados de crianças; aplicar somente em "Teste escala" nesta etapa.
begin;

alter table public.permissoes_equipe_kids
  drop constraint permissoes_equipe_kids_permissao_check;
alter table public.permissoes_equipe_kids
  add constraint permissoes_equipe_kids_permissao_check check(
    permissao in (
      'gerenciar_turmas','cadastrar_criancas','confirmar_cadastros','gerenciar_vinculos',
      'gerenciar_presencas','chamar_responsavel','consultar_saude',
      'montar_escalas','aprovar_escalas'
    )
  );

-- Líder, administrador ou permissão explícita podem renomear uma das quatro
-- turmas permanentes; editar o nome nunca troca o UUID nem as crianças vinculadas.
drop policy if exists turmas_inserir on public.turmas_kids;
drop policy if exists turmas_editar on public.turmas_kids;
create policy turmas_inserir on public.turmas_kids for insert to authenticated
  with check ((select private.lider_ativo()) or
              (select private.tem_permissao_kids('gerenciar_turmas')));
create policy turmas_editar on public.turmas_kids for update to authenticated
  using ((select private.lider_ativo()) or
         (select private.tem_permissao_kids('gerenciar_turmas')))
  with check ((select private.lider_ativo()) or
              (select private.tem_permissao_kids('gerenciar_turmas')));

-- Apenas apresentação da agenda; autorização infantil usa o UUID na tabela
-- escalas_turmas_kids, NUNCA o nome textual.
create or replace function private.kids_sincronizar_nome_turma()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.nome is distinct from old.nome then
    update public.escalas e
       set turma=new.nome
      from public.escalas_turmas_kids m
      where m.escala_id=e.id and m.turma_id=new.id
        and e.funcao in ('professor','auxiliar');
  end if;
  return new;
end $$;
revoke all on function private.kids_sincronizar_nome_turma() from public,anon,authenticated;
create trigger trg_kids_nome_turma_escala
  after update of nome on public.turmas_kids
  for each row execute function private.kids_sincronizar_nome_turma();

commit;
