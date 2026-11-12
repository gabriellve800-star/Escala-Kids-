-- PR2: testes funcionais de transacoes e RLS; 100% ficticios e revertidos.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000'::uuid,
 'authenticated','authenticated',v.email,'!',now(),now(),now()
from (values
('88888888-8888-4888-8888-000000000001','qa-pr2-admin@example.invalid'),
('88888888-8888-4888-8888-000000000002','qa-pr2-family-a@example.invalid'),
('88888888-8888-4888-8888-000000000003','qa-pr2-family-b@example.invalid'),
('88888888-8888-4888-8888-000000000004','qa-pr2-volunteer@example.invalid')
) v(id,email);
insert into public.perfis(id,usuario,nome,telefone,perfil,status)
values
('88888888-8888-4888-8888-000000000001','qafase3pr2adm','Admin Artificial',null,'administrador','ativo'),
('88888888-8888-4888-8888-000000000004','qafase3pr2vol','Voluntario Artificial','11988889999','voluntario','ativo');
insert into public.turmas_kids(id,posicao,nome,idade_min_meses,idade_max_meses)
values
('99999999-9999-4999-8999-000000000001',1,'Turma Teste Um',0,215),
('99999999-9999-4999-8999-000000000002',2,'Turma Teste Dois',0,215);
set local role authenticated;
set local request.jwt.claim.sub='88888888-8888-4888-8888-000000000001';

do $test$
declare code_a text; code_b text; kid_a uuid; kid_b uuid; kid_team uuid; n bigint; val boolean;
begin
  -- Termo ausente: bloqueia criacao infantil, ate para o administrador.
  begin
    perform * from public.kids_criar_crianca('Teste sem Termo','2020-01-01',
      '99999999-9999-4999-8999-000000000001',null);
    raise exception 'ERRO: criou crianca sem termo';
  exception when others then
    if SQLERRM<>'TERMO_NAO_PUBLICADO' then raise; end if;
  end;
  -- Adiciona termo 100% artificial APENAS na transacao, nao persistido.
  -- Para fixtures, a insercao em schema privado usa papel postgres.
  perform pg_catalog.set_config('role','none',true);
  insert into private.termos_kids(versao,texto,ativo)
   values('QA_PR2_DEMO','Termo exclusivamente artificial de QA. NAO constitui consentimento legal. '||
   'Nao registrar criancas reais e nao reutilizar este texto em qualquer ambiente de producao.',true);
  perform pg_catalog.set_config('role','authenticated',true);
  code_a=public.kids_emitir_convite_familia();
  code_b=public.kids_emitir_convite_familia();
  if code_a=code_b or length(code_a)<>64 or not public.kids_convite_familia_valido(code_a)
    then raise exception 'ERRO: convite familiar inseguro';end if;
  -- Familia A com e-mail supostamente validado na fixture Auth.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000002',true);
  val=public.kids_resgatar_convite_familia(code_a,'Responsavel Artificial A');
  if val is distinct from true then raise exception 'ERRO: falhou resgate A';end if;
  if private.familia_ativa() then raise exception 'ERRO: familia nao aprovada ganhou acesso';end if;
  begin
    perform public.kids_resgatar_convite_familia(code_a,'Duplicata');
    raise exception 'ERRO: permitiu resgate duplicado';
  exception when others then
    if SQLERRM<>'CONVITE_INDISPONIVEL' then raise;end if;
  end;
  -- Familia B
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000003',true);
  val=public.kids_resgatar_convite_familia(code_b,'Responsavel Artificial B');
  -- Voluntario nao tem acesso a familias, nem criancas.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000004',true);
  begin
    perform public.kids_aprovar_familia('88888888-8888-4888-8888-000000000002');
    raise exception 'ERRO: voluntario aprovou familia';
  exception when others then
    if SQLERRM<>'SEM_PERMISSAO' then raise;end if;
  end;
  select count(*) into n from public.familias_kids;
  if n<>0 then raise exception 'ERRO: voluntario viu familias';end if;
  begin
    perform * from public.kids_criar_crianca('Crianca de voluntario','2021-01-01',
      '99999999-9999-4999-8999-000000000001','QA_PR2_DEMO');
    raise exception 'ERRO: voluntario criou crianca';
  exception when others then
    if SQLERRM<>'SEM_PERMISSAO' then raise;end if;
  end;
  -- Administrador aprova ambas, sem elevar privilegios de familiares.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000001',true);
  val=public.kids_aprovar_familia('88888888-8888-4888-8888-000000000002');
  val=public.kids_aprovar_familia('88888888-8888-4888-8888-000000000003');
  -- Familia A cria filho, ainda aguardando equipe.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000002',true);
  select id into kid_a from public.kids_criar_crianca('Crianca Ficticia A','2021-01-01',
    '99999999-9999-4999-8999-000000000001','QA_PR2_DEMO');
  if kid_a is null then raise exception 'ERRO: criacao A';end if;
  -- Familia B cria outro filho.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000003',true);
  select id into kid_b from public.kids_criar_crianca('Crianca Ficticia B','2020-01-01',
    '99999999-9999-4999-8999-000000000002','QA_PR2_DEMO');
  select count(*) into n from public.criancas_kids where id=kid_a;
  if n<>0 then raise exception 'ERRO: familia B ve crianca A';end if;
  -- Admin aprova ambos, com consentimento ficticio cadastrado.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000001',true);
  val=public.kids_aprovar_crianca(kid_a);
  val=public.kids_aprovar_crianca(kid_b);
  select id into kid_team from public.kids_criar_crianca('Crianca da Equipe','2022-01-01',
    '99999999-9999-4999-8999-000000000001','QA_PR2_DEMO');
  val=public.kids_vincular_responsavel(kid_team,
    '88888888-8888-4888-8888-000000000002');
  -- Familia A aceita a crianca cadastrada pela equipe.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000002',true);
  select count(*) into n from public.criancas_kids where id=kid_team;
  if n<>1 then raise exception 'ERRO: filho da equipe nao visivel para consentimento';end if;
  val=public.kids_confirmar_filho(kid_team,'QA_PR2_DEMO');
  val=public.kids_pedir_privacidade('correcao',kid_a);
  select count(*) into n from public.criancas_kids;
  if n<>2 then raise exception 'ERRO: familia A enxerga filho B ou perdeu filho';end if;
  select count(*) into n from public.perfis;
  if n<>0 then raise exception 'ERRO: familia A obteve perfis';end if;
  -- Voluntario, ainda que no cadastro da equipe, nao pode ver dados infantis.
  perform pg_catalog.set_config('request.jwt.claim.sub','88888888-8888-4888-8888-000000000004',true);
  select count(*) into n from public.criancas_kids;
  if n<>0 then raise exception 'ERRO: voluntario le fichas';end if;
  if has_table_privilege('authenticated','private.saude_kids','SELECT')
    then raise exception 'ERRO: grant em saude';end if;
end $test$;
reset role;
rollback;
select 'PR2_FICTICIO_TRANSACIONAL_OK' as resultado;
