-- QA Escala Kids v1.2.7: testes sintéticos e TOTALMENTE reversíveis.
-- Fase 3: nenhuma criança/saúde/telefone reais, nenhum commit dos dados fictícios.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('44444444-4444-4444-8444-'||lpad(i::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',
  'v127-test-'||i::text||'@example.invalid','!',now(),now(),now()
from generate_series(1,13) i;
insert into public.perfis(id,usuario,nome,telefone,perfil,status)
select ('44444444-4444-4444-8444-'||lpad(i::text,12,'0'))::uuid,
  'v127t'||i::text,'Voluntario Artificial '||i::text,'11988889999',
  case when i=11 then 'administrador'
       when i=12 then 'lider' else 'voluntario' end,'ativo'
from generate_series(1,13) i;
insert into public.funcoes_pessoa(pessoa_id,funcao)
select ('44444444-4444-4444-8444-'||lpad(i::text,12,'0'))::uuid,
  case when i<=4 then 'professor' when i<=8 then 'auxiliar'
       when i=9 then 'portaria' else 'lanche' end
from generate_series(1,10) i;

insert into public.turmas_kids(id,posicao,nome,idade_min_meses,idade_max_meses)
select ('55555555-5555-4555-8555-'||lpad(i::text,12,'0'))::uuid,
 i::smallint,'Turma Teste '||i::text,((i-1)*36)::smallint,(i*36-1)::smallint
from generate_series(1,4) i;
insert into public.disponibilidades(pessoa_id,dia,culto)
select ('44444444-4444-4444-8444-'||lpad(i::text,12,'0'))::uuid,
  d::date, c.culto
from generate_series(date_trunc('month',now() at time zone 'America/Sao_Paulo'+interval '1 month')::date,
 (date_trunc('month',now() at time zone 'America/Sao_Paulo'+interval '2 months')-interval '1 day')::date,
 interval '1 day') d
cross join (values ('domingo_manha'),('domingo_noite'),('quarta_noite')) c(culto)
cross join generate_series(1,10) i
where (extract(isodow from d)=7 and c.culto in ('domingo_manha','domingo_noite'))
   or (extract(isodow from d)=3 and c.culto='quarta_noite');

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-000000000013',true);
do $qa$
begin
 begin
   perform public.kids_planejamento_base(
     date_trunc('month',(now() at time zone 'America/Sao_Paulo')+interval '1 month')::date);
   raise exception 'FALHA: voluntario acessou planejamento';
 exception when others then
   if SQLERRM<>'SEM_PERMISSAO' then raise;end if;
 end;
end $qa$;

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-000000000011',true);
-- Admin delega apenas MONTAR, sem aprovar; a permissão nunca abre crianças.
insert into public.permissoes_equipe_kids(pessoa_id,permissao,concedida_por)
values('44444444-4444-4444-8444-000000000013','montar_escalas',
       '44444444-4444-4444-8444-000000000011');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-000000000013',true);
do $qa$
declare mes date;
begin
 mes=date_trunc('month',(now() at time zone 'America/Sao_Paulo')+interval '1 month')::date;
 if not private.kids_pode_planejar() or private.kids_pode_aprovar_escala()
   then raise exception 'FALHA: delegação montagem virou aprovação';end if;
 if jsonb_array_length(public.kids_planejamento_base(mes)->'equipe')<>13
   then raise exception 'FALHA: base delegada não carregou';end if;
 begin
  perform public.kids_aprovar_sugestao(mes,1);
  raise exception 'FALHA: delegado aprovou escala';
 exception when others then if SQLERRM<>'SEM_PERMISSAO' then raise;end if;end;
end $qa$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-000000000011',true);
do $qa$
declare mes date;itens jsonb;vers integer;quantidade int;src jsonb;
begin
 mes=date_trunc('month',(now() at time zone 'America/Sao_Paulo')+interval '1 month')::date;
 src=public.kids_planejamento_base(mes);
 if jsonb_array_length(src->'turmas')<>4 or
    jsonb_array_length(src->'equipe')<>13 then raise exception 'FALHA: base do planejador';end if;
 if src::text like '%1198888%' or src::text like '%email%' or src::text like '%saude%'
   then raise exception 'FALHA: base expôs campo não autorizado';end if;

 with dias as (
  select d::date dia,c.culto
  from generate_series(mes::timestamp,
    (mes+interval '1 month'-interval '1 day')::timestamp,interval '1 day') d
  cross join (values ('domingo_manha'),('domingo_noite'),('quarta_noite')) c(culto)
  where (extract(isodow from d)=7 and c.culto in ('domingo_manha','domingo_noite'))
    or (extract(isodow from d)=3 and c.culto='quarta_noite')
 ),
 necessidades as (
  select d.dia,d.culto,v.funcao,t.id turma_id,
    case when v.funcao='professor' then t.posicao else t.posicao+4 end pessoa_ordem
  from dias d cross join public.turmas_kids t
  cross join (values ('professor'),('auxiliar')) v(funcao)
  union all select d.dia,d.culto,'portaria',null::uuid,9 from dias d
  union all select d.dia,d.culto,'lanche',null::uuid,10 from dias d
 )
 select jsonb_agg(jsonb_build_object(
   'dia',n.dia::text,'culto',n.culto,'funcao',n.funcao,
   'turma_id',n.turma_id,
   'pessoa_id',('44444444-4444-4444-8444-'||lpad(n.pessoa_ordem::text,12,'0'))::uuid,
   'horario',case when n.culto='domingo_manha' then '09:00'
      when n.culto='domingo_noite' then '18:00' else '19:30' end
 )) into itens from necessidades n;
 vers=public.kids_salvar_sugestao(mes,itens);
 if vers<>1 then raise exception 'FALHA: versão inicial';end if;
 begin
   perform public.kids_salvar_sugestao(mes,itens,999);
   raise exception 'FALHA: atualização de versão obsoleta';
 exception when others then
   if SQLERRM<>'RASCUNHO_DESATUALIZADO_OU_APROVADO' then raise;end if;
 end;
 quantidade=public.kids_aprovar_sugestao(mes,vers);
 if quantidade<>jsonb_array_length(itens) then raise exception 'FALHA: publicação não atômica';end if;
 if (select count(*) from public.escalas e
      where e.dia>=mes and e.dia<(mes+interval '1 month')::date)<>quantidade
    then raise exception 'FALHA: quantidade publicada';end if;
 if (select count(*) from public.escalas_turmas_kids)<>quantidade*8/10
    then raise exception 'FALHA: mapeamento de turmas e cargos';end if;

 begin
   perform public.kids_aprovar_sugestao(mes,vers);
   raise exception 'FALHA: aprovação duplicada';
 exception when others then
   if SQLERRM<>'RASCUNHO_DESATUALIZADO_OU_APROVADO' then raise;end if;
 end;
end $qa$;

-- Líder renomeia turma fixa após publicação e mapeamento fica intacto.
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-000000000012',true);
update public.turmas_kids set nome='Turma Teste Renomeada 1' where posicao=1;
do $qa$
declare n int;
begin
 select count(*) into n from public.escalas e
 join public.escalas_turmas_kids m on m.escala_id=e.id
 join public.turmas_kids t on t.id=m.turma_id
 where t.posicao=1 and e.funcao='professor' and e.turma=t.nome;
 if n=0 then raise exception 'FALHA: mudança de nome não atualizou escala';end if;
end $qa$;
reset role;
rollback;
select 'QA_V127_PLANEJAMENTO_RLS_ATOMICO_OK' as resultado;
