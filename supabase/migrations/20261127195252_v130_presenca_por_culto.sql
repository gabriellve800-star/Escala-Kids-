-- Attendance phase: private RPCs, current service only, no direct table writes.
create function private.kids_presenca_dia() returns date language sql stable set search_path='' as $$
 select (now() at time zone 'America/Sao_Paulo')::date
$$;
create function private.kids_presenca_culto_valido(p_culto text) returns boolean language sql stable set search_path='' as $$
 select coalesce((extract(isodow from private.kids_presenca_dia())=7 and p_culto in ('domingo_manha','domingo_noite')) or (extract(isodow from private.kids_presenca_dia())=3 and p_culto='quarta_noite'),false)
$$;
create function private.kids_presenca_pode_operar(p_turma uuid,p_culto text) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and private.equipe_ativa() and private.kids_presenca_culto_valido(p_culto)
 and (private.admin_ativo() or private.lider_ativo() or private.escalada_turma_kids(p_turma,p_culto))
$$;
create function private.kids_presenca_lista(p_culto text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d date:=private.kids_presenca_dia(); result jsonb;
begin
 if (select auth.uid()) is null or not private.equipe_ativa() then raise exception 'SEM_PERMISSAO';end if;
 if not private.kids_presenca_culto_valido(p_culto) then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('crianca_id',c.id,'nome',c.nome,'numero',c.numero,'turma',t.nome,
 'estado',coalesce(p.estado,'nao_registrada'),'entrada_em',p.entrada_em,'saida_em',p.saida_em,
 'responsaveis',case when p.estado='presente' then coalesce((select jsonb_agg(jsonb_build_object('id',f.usuario_id,'nome',f.nome) order by f.nome)
 from public.vinculos_kids v join public.familias_kids f on f.usuario_id=v.responsavel_id
 where v.crianca_id=c.id and v.status='confirmado' and f.status='ativo'), '[]'::jsonb) else '[]'::jsonb end)
 order by t.posicao,c.nome),'[]'::jsonb) into result
 from public.criancas_kids c
 left join public.presencas_kids p on p.crianca_id=c.id and p.dia=d and p.culto=p_culto
 join public.turmas_kids t on t.id=coalesce(p.turma_id,c.turma_id)
 where (c.status='ativo' or p.estado='presente') and private.kids_presenca_pode_operar(t.id,p_culto);
 return result;
end $$;
create function private.kids_presenca_registrar(p_crianca uuid,p_culto text,p_acao text,p_responsavel uuid default null,p_conferido boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); d date:=private.kids_presenca_dia(); c public.criancas_kids%rowtype; p public.presencas_kids%rowtype; destino uuid;
begin
 if uid is null or not private.equipe_ativa() then raise exception 'SEM_PERMISSAO';end if;
 if not private.kids_presenca_culto_valido(p_culto) then raise exception 'CULTO_INVALIDO';end if;
 select * into c from public.criancas_kids where id=p_crianca for update;
 if not found then raise exception 'OPERACAO_NAO_PERMITIDA';end if;
 select * into p from public.presencas_kids where crianca_id=p_crianca and dia=d and culto=p_culto for update;
 if not private.kids_presenca_pode_operar(coalesce(p.turma_id,c.turma_id),p_culto) then raise exception 'SEM_PERMISSAO';end if;
 if p_acao='entrada' then
   if p.id is not null then
     if p.estado='presente' then return p.id;end if;
     raise exception 'SAIDA_JA_REGISTRADA';
   end if;
   if c.status<>'ativo' or not exists(select 1 from public.turmas_kids t where t.id=c.turma_id and t.ativa)
     or not exists(select 1 from public.vinculos_kids v join public.familias_kids f on f.usuario_id=v.responsavel_id
       join public.consentimentos_kids a on a.crianca_id=v.crianca_id and a.responsavel_id=v.responsavel_id
       join private.termos_kids t on t.versao=a.versao_termo
       where v.crianca_id=c.id and v.status='confirmado' and f.status='ativo' and a.finalidade='cadastro' and a.revogado_em is null and t.ativo)
     then raise exception 'CADASTRO_OU_CONSENTIMENTO_PENDENTE';end if;
   if exists(select 1 from public.presencas_kids z where z.crianca_id=c.id and z.estado='presente') then raise exception 'PRESENCA_ABERTA_ANTERIOR';end if;
   insert into public.presencas_kids(crianca_id,dia,culto,turma_id,operador_id) values(c.id,d,p_culto,c.turma_id,uid) returning id into destino;
   insert into public.auditoria(quem,acao,alvo,detalhes) values(uid,'kids_entrada',destino,'{}'::jsonb);
 elsif p_acao='saida' then
   if p.id is null or p.estado<>'presente' then raise exception 'SEM_PRESENCA_ABERTA';end if;
   if p_conferido is distinct from true or p_responsavel is null or not exists(
     select 1 from public.vinculos_kids v join public.familias_kids f on f.usuario_id=v.responsavel_id
     where v.crianca_id=c.id and v.responsavel_id=p_responsavel and v.status='confirmado' and f.status='ativo')
     then raise exception 'RESPONSAVEL_NAO_CONFERIDO';end if;
   update public.presencas_kids set estado='saiu',saida_em=now() where id=p.id returning id into destino;
   insert into public.auditoria(quem,acao,alvo,detalhes) values(uid,'kids_saida',destino,jsonb_build_object('responsavel_id',p_responsavel,'conferencia_presencial',true));
 else raise exception 'OPERACAO_NAO_PERMITIDA';end if;
 return destino;
end $$;
create function private.kids_presenca_familia() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.familia_ativa() then raise exception 'SEM_PERMISSAO';end if;
 select coalesce(jsonb_agg(jsonb_build_object('numero',c.numero,'nome',c.nome,'culto',p.culto,'dia',p.dia,'estado',p.estado,'entrada_em',p.entrada_em,'saida_em',p.saida_em) order by p.entrada_em desc),'[]'::jsonb)
 into result from public.presencas_kids p join public.criancas_kids c on c.id=p.crianca_id
 where p.dia=private.kids_presenca_dia() and private.familia_vinculada_kids(c.id);
 return result;
end $$;
create function public.kids_presenca_lista(p_culto text) returns jsonb language sql stable security invoker set search_path='' as $$select private.kids_presenca_lista(p_culto)$$;
create function public.kids_presenca_registrar(p_crianca uuid,p_culto text,p_acao text,p_responsavel uuid default null,p_conferido boolean default false) returns uuid language sql volatile security invoker set search_path='' as $$select private.kids_presenca_registrar(p_crianca,p_culto,p_acao,p_responsavel,p_conferido)$$;
create function public.kids_presenca_familia() returns jsonb language sql stable security invoker set search_path='' as $$select private.kids_presenca_familia()$$;
revoke all on function private.kids_presenca_dia(),private.kids_presenca_culto_valido(text),private.kids_presenca_pode_operar(uuid,text) from public,anon,authenticated;
revoke all on function private.kids_presenca_lista(text),private.kids_presenca_registrar(uuid,text,text,uuid,boolean),private.kids_presenca_familia(),public.kids_presenca_lista(text),public.kids_presenca_registrar(uuid,text,text,uuid,boolean),public.kids_presenca_familia() from public,anon,authenticated;
grant execute on function private.kids_presenca_lista(text),private.kids_presenca_registrar(uuid,text,text,uuid,boolean),private.kids_presenca_familia(),public.kids_presenca_lista(text),public.kids_presenca_registrar(uuid,text,text,uuid,boolean),public.kids_presenca_familia() to authenticated;
