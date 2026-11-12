-- Fase 3 PR 1: hardening aditivo apos auditoria Supabase Advisors.
-- Nenhuma policy de permissao direta e criada para dados clinicos/secrets.
create index if not exists idx_convites_familia_kids_criado_por on private.convites_familia_kids(criado_por);
create index if not exists idx_saude_kids_revisado_por on private.saude_kids(revisado_por);
create index if not exists idx_chamados_kids_criado_por on public.chamados_kids(criado_por);
create index if not exists idx_coberturas_kids_concedida_por on public.coberturas_kids(concedida_por);
create index if not exists idx_coberturas_kids_turma on public.coberturas_kids(turma_id);
create index if not exists idx_consentimentos_kids_responsavel on public.consentimentos_kids(responsavel_id);
create index if not exists idx_escalas_turmas_kids_vinculada_por on public.escalas_turmas_kids(vinculada_por);
create index if not exists idx_familias_kids_aprovado_por on public.familias_kids(aprovado_por);
create index if not exists idx_presencas_kids_operador on public.presencas_kids(operador_id);
create index if not exists idx_presencas_kids_turma on public.presencas_kids(turma_id);
create index if not exists idx_solicitacoes_privacidade_kids_crianca on public.solicitacoes_privacidade_kids(crianca_id);
create index if not exists idx_vinculos_kids_confirmado_por on public.vinculos_kids(confirmado_por);

-- Deny-all explicito mesmo se alguem conceder GRANT por engano.
-- service_role do backend continua podendo operar sob revisao de autorizacao.
create policy pvt_saude_deny on private.saude_kids
  for all to public using(false) with check(false);
create policy pvt_push_deny on private.assinaturas_push_kids
  for all to public using(false) with check(false);
create policy pvt_convites_deny on private.convites_familia_kids
  for all to public using(false) with check(false);
create policy pvt_retencao_deny on private.retencao_kids
  for all to public using(false) with check(false);
