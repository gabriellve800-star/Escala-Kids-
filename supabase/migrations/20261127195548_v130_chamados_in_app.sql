-- In-app guardian requests. No health information, phone or notification claim.
create function private.kids_chamados_equipe(p_culto text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if not private.equipe_ativa() then raise exception 'SEM_PERMISSAO';end if;
 if not private.kids_presenca_culto_valido(p_culto) then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('crianca_id',p.crianca_id,'status',c.status,'criado_em',c.criado_em) order by c.criado_em desc),'[]'::jsonb) into r
 from public.chamados_kids c join public.presencas_kids p on p.id=c.presenca_id
 where p.dia=private.kids_presenca_dia() and p.culto=p_culto and p.estado='presente'
 and c.status in ('enviado','visto','a_caminho') and private.kids_presenca_pode_operar(p.turma_id,p_culto);
 return r;
end $$;
create function private.kids_chamar_responsavel(p_crianca uuid,p_culto text) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); p public.presencas_kids%rowtype; n integer;
begin
 if uid is null or not private.equipe_ativa() then raise exception 'SEM_PERMISSAO';end if;
 select * into p from public.presencas_kids where crianca_id=p_crianca and dia=private.kids_presenca_dia() and culto=p_culto for update;
 if not found or not private.kids_presenca_pode_operar(p.turma_id,p_culto) then raise exception 'SEM_PERMISSAO';end if;
 if p.estado<>'presente' then raise exception 'SEM_PRESENCA_ABERTA';end if;
 if exists(select 1 from public.chamados_kids where presenca_id=p.id and status in ('enviado','visto','a_caminho')) then raise exception 'CHAMADO_ABERTO';end if;
 insert into public.chamados_kids(presenca_id,responsavel_id,criado_por,motivo)
 select p.id,f.usuario_id,uid,null
 from public.familias_kids f join public.vinculos_kids v on v.responsavel_id=f.usuario_id
 where v.crianca_id=p.crianca_id and v.status='confirmado' and f.status='ativo'
 and exists(select 1 from public.consentimentos_kids a join private.termos_kids t on t.versao=a.versao_termo where a.crianca_id=p.crianca_id and a.responsavel_id=f.usuario_id and a.finalidade='cadastro' and a.revogado_em is null and t.ativo);
 get diagnostics n=row_count;
 if n=0 then raise exception 'SEM_RESPONSAVEL_ATIVO';end if;
 insert into public.auditoria(quem,acao,alvo,detalhes) values(uid,'kids_chamado_criado',p.id,jsonb_build_object('destinatarios',n));
 return n;
end $$;
create function private.kids_chamados_familia() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if not private.familia_ativa() then raise exception 'SEM_PERMISSAO';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nome',k.nome,'numero',k.numero,'status',c.status,'criado_em',c.criado_em) order by c.criado_em desc),'[]'::jsonb) into r
 from public.chamados_kids c join public.presencas_kids p on p.id=c.presenca_id join public.criancas_kids k on k.id=p.crianca_id
 where c.responsavel_id=(select auth.uid()) and p.dia=private.kids_presenca_dia()
 and p.estado='presente' and c.status in ('enviado','visto','a_caminho')
 and private.familia_vinculada_kids(p.crianca_id);
 return r;
end $$;
create function private.kids_chamado_responder(p_id uuid,p_acao text) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.chamados_kids%rowtype; p public.presencas_kids%rowtype; uid uuid:=(select auth.uid());
begin
 if uid is null or not private.familia_ativa() then raise exception 'SEM_PERMISSAO';end if;
 select * into c from public.chamados_kids where id=p_id and responsavel_id=uid;
 if not found then raise exception 'SEM_PERMISSAO';end if;
 select * into p from public.presencas_kids where id=c.presenca_id for update;
 if not found or p.dia<>private.kids_presenca_dia() or p.estado<>'presente' or not private.familia_vinculada_kids(p.crianca_id) then raise exception 'SEM_PERMISSAO';end if;
 select * into c from public.chamados_kids where id=p_id and responsavel_id=uid for update;
 if c.status not in ('enviado','visto','a_caminho') then raise exception 'CHAMADO_ENCERRADO';end if;
 if p_acao='visto' then
  if c.status='enviado' then update public.chamados_kids set status='visto',visto_em=now() where id=c.id;end if;
 elsif p_acao='a_caminho' then
  if c.status<>'a_caminho' then update public.chamados_kids set status='a_caminho',visto_em=coalesce(visto_em,now()),a_caminho_em=now() where id=c.id;end if;
 else raise exception 'OPERACAO_NAO_PERMITIDA';end if;
 return true;
end $$;
create function private.kids_chamado_encerrar(p_crianca uuid,p_culto text,p_acao text) returns integer language plpgsql security definer set search_path='' as $$
declare p public.presencas_kids%rowtype; n integer; uid uuid:=(select auth.uid());
begin
 if uid is null or not private.equipe_ativa() then raise exception 'SEM_PERMISSAO';end if;
 if p_acao not in ('resolvido','cancelado','sem_resposta') or p_acao is null then raise exception 'OPERACAO_NAO_PERMITIDA';end if;
 select * into p from public.presencas_kids where crianca_id=p_crianca and dia=private.kids_presenca_dia() and culto=p_culto for update;
 if not found or not private.kids_presenca_pode_operar(p.turma_id,p_culto) then raise exception 'SEM_PERMISSAO';end if;
 update public.chamados_kids set status=p_acao,resolvido_em=case when p_acao='resolvido' then now() else resolvido_em end,
 cancelado_em=case when p_acao='cancelado' then now() else cancelado_em end,sem_resposta_em=case when p_acao='sem_resposta' then now() else sem_resposta_em end
 where presenca_id=p.id and status in ('enviado','visto','a_caminho');
 get diagnostics n=row_count;
 if n>0 then insert into public.auditoria(quem,acao,alvo,detalhes) values(uid,'kids_chamado_encerrado',p.id,jsonb_build_object('estado',p_acao));end if;
 return n;
end $$;
-- A checkout closes the app request but does not claim the parent saw it.
create function private.kids_chamados_encerrar_na_saida() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.estado='presente' and new.estado='saiu' then
 update public.chamados_kids set status='resolvido',resolvido_em=now() where presenca_id=new.id and status in ('enviado','visto','a_caminho');
 end if;
 return new;
end $$;
create trigger kids_chamados_na_saida after update of estado on public.presencas_kids for each row execute function private.kids_chamados_encerrar_na_saida();
create function public.kids_chamados_equipe(p_culto text) returns jsonb language sql stable security invoker set search_path='' as $$select private.kids_chamados_equipe(p_culto)$$;
create function public.kids_chamar_responsavel(p_crianca uuid,p_culto text) returns integer language sql volatile security invoker set search_path='' as $$select private.kids_chamar_responsavel(p_crianca,p_culto)$$;
create function public.kids_chamados_familia() returns jsonb language sql stable security invoker set search_path='' as $$select private.kids_chamados_familia()$$;
create function public.kids_chamado_responder(p_id uuid,p_acao text) returns boolean language sql volatile security invoker set search_path='' as $$select private.kids_chamado_responder(p_id,p_acao)$$;
create function public.kids_chamado_encerrar(p_crianca uuid,p_culto text,p_acao text) returns integer language sql volatile security invoker set search_path='' as $$select private.kids_chamado_encerrar(p_crianca,p_culto,p_acao)$$;
revoke all on function private.kids_chamados_encerrar_na_saida(),private.kids_chamados_equipe(text),private.kids_chamar_responsavel(uuid,text),private.kids_chamados_familia(),private.kids_chamado_responder(uuid,text),private.kids_chamado_encerrar(uuid,text,text),public.kids_chamados_equipe(text),public.kids_chamar_responsavel(uuid,text),public.kids_chamados_familia(),public.kids_chamado_responder(uuid,text),public.kids_chamado_encerrar(uuid,text,text) from public,anon,authenticated;
grant execute on function private.kids_chamados_equipe(text),private.kids_chamar_responsavel(uuid,text),private.kids_chamados_familia(),private.kids_chamado_responder(uuid,text),private.kids_chamado_encerrar(uuid,text,text),public.kids_chamados_equipe(text),public.kids_chamar_responsavel(uuid,text),public.kids_chamados_familia(),public.kids_chamado_responder(uuid,text),public.kids_chamado_encerrar(uuid,text,text) to authenticated;
