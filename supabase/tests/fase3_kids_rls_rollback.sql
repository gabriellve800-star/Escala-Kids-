-- FASE3 PR1: testes SQL integrados no Supabase TESTE.
-- Tudo transacional: usuarios/criancas ficticias desaparecem no ROLLBACK.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',
  'fase3-'+v.suffix+'@example.invalid','!',now(),now(),now()
from (values
('11111111-1111-4111-8111-000000000001','admin'),
('11111111-1111-4111-8111-000000000002','leader'),
('11111111-1111-4111-8111-000000000003','teacher'),
('11111111-1111-4111-8111-000000000004','volunteer'),
('11111111-1111-4111-8111-000000000005','family-a'),
('11111111-1111-4111-8111-000000000006','family-b')
) as v(id,suffix);
insert into public.perfis(id,usuario,nome,telefone,perfil,status)
values
('11111111-1111-4111-8111-000000000001','qafase3admin','Admin Ficticio',null,'administrador','ativo'),
('11111111-1111-4111-8111-000000000002','qafase3leader','Lider Ficticio','11988880002','lider','ativo'),
('11111111-1111-4111-8111-000000000003','qafase3teacher','Professor Ficticio','11988880003','voluntario','ativo'),
('11111111-1111-4111-8111-000000000004','qafase3volunteer','Voluntario Ficticio','11988880004','voluntario','ativo');
insert into public.familias_kids(usuario_id,nome,status,email_confirmado_em,aprovado_por,aprovado_em)
values
('11111111-1111-4111-8111-000000000005','Familia Ficticia A','ativo',now(),'11111111-1111-4111-8111-000000000001',now()),
('11111111-1111-4111-8111-000000000006','Familia Ficticia B','ativo',now(),'11111111-1111-4111-8111-000000000001',now());
insert into public.turmas_kids(id,posicao,nome,idade_min_meses,idade_max_meses)
values
('22222222-2222-4222-8222-000000000001',1,'Turma Simulada A',0,60),
('22222222-2222-4222-8222-000000000002',2,'Turma Simulada B',61,120);
insert into public.criancas_kids(id,nome,nascimento,turma_id,origem,status,criado_por)
values
('33333333-3333-4333-8333-000000000001','Crianca Artificial A','2021-01-01',
 '22222222-2222-4222-8222-000000000001','familia','ativo','11111111-1111-4111-8111-000000000005'),
('33333333-3333-4333-8333-000000000002','Crianca Artificial B','2020-01-01',
 '22222222-2222-4222-8222-000000000002','familia','ativo','11111111-1111-4111-8111-000000000006');
insert into public.vinculos_kids(crianca_id,responsavel_id,parentesco,status,
confirmado_por,confirmado_em)
values
('33333333-3333-4333-8333-000000000001','11111111-1111-4111-8111-000000000005',
 'Responsavel','confirmado','11111111-1111-4111-8111-000000000001',now()),
('33333333-3333-4333-8333-000000000002','11111111-1111-4111-8111-000000000006',
 'Responsavel','confirmado','11111111-1111-4111-8111-000000000001',now());
insert into private.saude_kids(crianca_id,alergias,condicoes) values
('33333333-3333-4333-8333-000000000001','Dado simulado','Sem condicao real');
-- Escala futura com vinculo UUID nao autoriza acesso HOJE.
insert into public.escalas(id,pessoa_id,dia,culto,horario,turma,funcao)
values(
 '44444444-4444-4444-8444-000000000001','11111111-1111-4111-8111-000000000003',
 ((date_trunc('week',now() at time zone 'America/Sao_Paulo')::date)+6),
 'domingo_manha','09:00','Turma Simulada A','professor');
insert into public.escalas_turmas_kids(escala_id,turma_id,vinculada_por)
values('44444444-4444-4444-8444-000000000001',
'22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-000000000005';
do $qa$
declare n bigint;
begin
 if private.equipe_ativa() or not private.familia_ativa() then
   raise exception 'ERRO: identidade de familia ganhou direitos de equipe';
 end if;
 select count(*) into n from public.criancas_kids
 where id='33333333-3333-4333-8333-000000000001';
 if n<>1 then raise exception 'ERRO: familia A nao ve seu filho'; end if;
 select count(*) into n from public.criancas_kids
 where id='33333333-3333-4333-8333-000000000002';
 if n<>0 then raise exception 'ERRO: familia A ve filho da familia B'; end if;
 select count(*) into n from public.perfis;
 if n<>0 then raise exception 'ERRO: familia acessa perfis da equipe'; end if;
 select count(*) into n from public.escalas;
 if n<>0 then raise exception 'ERRO: familia acessa escalas da equipe'; end if;
 select count(*) into n from public.funcoes_pessoa;
 if n<>0 then raise exception 'ERRO: familia acessa funcoes'; end if;
 select count(*) into n from public.convites;
 if n<>0 then raise exception 'ERRO: familia acessa convites'; end if;
 select count(*) into n from public.vinculos_kids;
 if n<>1 then raise exception 'ERRO: vinculos cruzados'; end if;
 if has_table_privilege('authenticated','private.saude_kids','SELECT') then
   raise exception 'ERRO: saude concedida a authenticated'; end if;
 if has_table_privilege('authenticated','private.assinaturas_push_kids','SELECT') then
   raise exception 'ERRO: push concedido a authenticated'; end if;
 if has_table_privilege('authenticated','public.criancas_kids','INSERT') then
   raise exception 'ERRO: criancas podem ser cadastradas sem backend'; end if;
end $qa$;

set local request.jwt.claim.sub='11111111-1111-4111-8111-000000000006';
do $qa$
declare n bigint;
begin
 select count(*) into n from public.criancas_kids
 where id='33333333-3333-4333-8333-000000000002';
 if n<>1 then raise exception 'ERRO: familia B nao ve seu filho';end if;
 select count(*) into n from public.criancas_kids
 where id='33333333-3333-4333-8333-000000000001';
 if n<>0 then raise exception 'ERRO: familia B ve filho A';end if;
end $qa$;

set local request.jwt.claim.sub='11111111-1111-4111-8111-000000000003';
do $qa$
declare n bigint;
begin
 if not private.equipe_ativa() or private.familia_ativa() then
   raise exception 'ERRO: identidade do professor';end if;
 select count(*) into n from public.criancas_kids;
 if n<>0 then raise exception 'ERRO: professor ve turmas sem escala HOJE';end if;
 if private.escalada_turma_kids('22222222-2222-4222-8222-000000000002') then
   raise exception 'ERRO: professor tem acesso a outra turma';end if;
end $qa$;

set local request.jwt.claim.sub='11111111-1111-4111-8111-000000000004';
do $qa$
declare n bigint;
begin
 select count(*) into n from public.criancas_kids;
 if n<>0 then raise exception 'ERRO: voluntario comum ve criancas';end if;
 if private.tem_permissao_kids('gerenciar_turmas') then
   raise exception 'ERRO: voluntario recebeu permissao sem concessao';end if;
end $qa$;

set local request.jwt.claim.sub='11111111-1111-4111-8111-000000000001';
do $qa$
declare n bigint;
begin
 if not private.admin_ativo() or not private.tem_permissao_kids('gerenciar_turmas') then
   raise exception 'ERRO: admin sem acesso total';end if;
 select count(*) into n from public.criancas_kids
 where id in ('33333333-3333-4333-8333-000000000001','33333333-3333-4333-8333-000000000002');
 if n<>2 then raise exception 'ERRO: admin sem ambas as criancas';end if;
end $qa$;
insert into public.permissoes_equipe_kids(pessoa_id,permissao,concedida_por)
values('11111111-1111-4111-8111-000000000004','gerenciar_turmas',
'11111111-1111-4111-8111-000000000001');
-- Verifica que a concessao NAO concede acesso a criancas/saude.
set local request.jwt.claim.sub='11111111-1111-4111-8111-000000000004';
do $qa$
declare n bigint;
begin
 if not private.tem_permissao_kids('gerenciar_turmas') then
   raise exception 'ERRO: delegacao administrativa nao funcionou'; end if;
 select count(*) into n from public.criancas_kids;
 if n<>0 then raise exception 'ERRO: permissao turmas abriu acesso a criancas';end if;
end $qa$;
update public.turmas_kids set nome='Turma Simulada A Renovada'
where id='22222222-2222-4222-8222-000000000001';

-- Nenhum registro ficticio permanece; sequencia de numeros nao e revertida.
reset role;
rollback;
select 'FASE3_RLS_NEGATIVE_TESTS_OK' as resultado;
