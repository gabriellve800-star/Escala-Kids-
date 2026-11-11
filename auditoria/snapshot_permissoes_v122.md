# Escala Kids — Snapshot das permissões reais do projeto (11/11/2026)

Somente auditoria. Estado consultado na produção; não aplicar novamente sem revisão. Sem dados pessoais ou segredos.

## Tabelas e RLS

```json
[
  {
    "schema": "public",
    "table_name": "auditoria",
    "enabled": true,
    "enforced": false
  },
  {
    "schema": "public",
    "table_name": "convites",
    "enabled": true,
    "enforced": false
  },
  {
    "schema": "public",
    "table_name": "funcoes_pessoa",
    "enabled": true,
    "enforced": false
  },
  {
    "schema": "public",
    "table_name": "perfis",
    "enabled": true,
    "enforced": false
  }
]
```

## Políticas RLS

```json
[
  {
    "schemaname": "public",
    "tablename": "auditoria",
    "policyname": "auditoria_admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "( SELECT private.admin_ativo() AS admin_ativo)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "convites",
    "policyname": "convites_leitura_autorizada",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "( SELECT private.pode_aprovar() AS pode_aprovar)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "funcoes_pessoa",
    "policyname": "funcoes_leitura_restrita",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(( SELECT private.ativo() AS ativo) AND ((pessoa_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.lider_ativo() AS lider_ativo) OR ( SELECT private.admin_ativo() AS admin_ativo)))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "perfis",
    "policyname": "perfis_leitura_restrita",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.admin_ativo() AS admin_ativo) OR (( SELECT private.lider_ativo() AS lider_ativo) AND (status = 'ativo'::text)) OR (( SELECT private.pode_aprovar() AS pode_aprovar) AND (status = 'pendente'::text)))",
    "with_check": null
  }
]
```

## Grants nas tabelas

```json
[
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "authenticated",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "DELETE"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "INSERT"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "REFERENCES"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "TRIGGER"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "TRUNCATE"
  },
  {
    "table_schema": "public",
    "table_name": "auditoria",
    "grantee": "service_role",
    "privilege_type": "UPDATE"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "authenticated",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "DELETE"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "INSERT"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "REFERENCES"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "TRIGGER"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "TRUNCATE"
  },
  {
    "table_schema": "public",
    "table_name": "convites",
    "grantee": "service_role",
    "privilege_type": "UPDATE"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "authenticated",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "DELETE"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "INSERT"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "REFERENCES"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "TRIGGER"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "TRUNCATE"
  },
  {
    "table_schema": "public",
    "table_name": "funcoes_pessoa",
    "grantee": "service_role",
    "privilege_type": "UPDATE"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "authenticated",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "DELETE"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "INSERT"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "REFERENCES"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "SELECT"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "TRIGGER"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "TRUNCATE"
  },
  {
    "table_schema": "public",
    "table_name": "perfis",
    "grantee": "service_role",
    "privilege_type": "UPDATE"
  }
]
```

## Permissões de execução de funções

```json
[
  {
    "schema": "private",
    "proname": "admin_ativo",
    "arguments": "",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "admin_ativo",
    "arguments": "",
    "role": "authenticated",
    "executable": true
  },
  {
    "schema": "private",
    "proname": "admin_ativo",
    "arguments": "",
    "role": "service_role",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "ativo",
    "arguments": "",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "ativo",
    "arguments": "",
    "role": "authenticated",
    "executable": true
  },
  {
    "schema": "private",
    "proname": "ativo",
    "arguments": "",
    "role": "service_role",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "lider_ativo",
    "arguments": "",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "lider_ativo",
    "arguments": "",
    "role": "authenticated",
    "executable": true
  },
  {
    "schema": "private",
    "proname": "lider_ativo",
    "arguments": "",
    "role": "service_role",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "pode_aprovar",
    "arguments": "",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "private",
    "proname": "pode_aprovar",
    "arguments": "",
    "role": "authenticated",
    "executable": true
  },
  {
    "schema": "private",
    "proname": "pode_aprovar",
    "arguments": "",
    "role": "service_role",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "emitir_convite",
    "arguments": "p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "emitir_convite",
    "arguments": "p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "emitir_convite",
    "arguments": "p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "emitir_convite",
    "arguments": "p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "emitir_convite",
    "arguments": "p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "emitir_convite",
    "arguments": "p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "finalizar_cadastro",
    "arguments": "p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "finalizar_cadastro",
    "arguments": "p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "finalizar_cadastro",
    "arguments": "p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "finalizar_primeiro_acesso",
    "arguments": "p_pessoa uuid",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "finalizar_primeiro_acesso",
    "arguments": "p_pessoa uuid",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "finalizar_primeiro_acesso",
    "arguments": "p_pessoa uuid",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "gerir_pessoa",
    "arguments": "p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "gerir_pessoa",
    "arguments": "p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "gerir_pessoa",
    "arguments": "p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "limitar_cadastro",
    "arguments": "p_chave text",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "limitar_cadastro",
    "arguments": "p_chave text",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "limitar_cadastro",
    "arguments": "p_chave text",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "revisar_cadastro",
    "arguments": "p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "revisar_cadastro",
    "arguments": "p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "revisar_cadastro",
    "arguments": "p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean",
    "role": "service_role",
    "executable": true
  },
  {
    "schema": "public",
    "proname": "revogar_convite",
    "arguments": "p_ator uuid, p_convite uuid",
    "role": "anon",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "revogar_convite",
    "arguments": "p_ator uuid, p_convite uuid",
    "role": "authenticated",
    "executable": false
  },
  {
    "schema": "public",
    "proname": "revogar_convite",
    "arguments": "p_ator uuid, p_convite uuid",
    "role": "service_role",
    "executable": true
  }
]
```

## Triggers de aplicação

```sql

```

## Definições completas de todas as funções SQL do aplicativo

```sql
-- private.admin_ativo()
CREATE OR REPLACE FUNCTION private.admin_ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and p.perfil='administrador' and not p.primeiro_acesso);
$function$
;

-- private.ativo()
CREATE OR REPLACE FUNCTION private.ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and not p.primeiro_acesso);
$function$
;

-- private.lider_ativo()
CREATE OR REPLACE FUNCTION private.lider_ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and p.perfil='lider' and not p.primeiro_acesso);
$function$
;

-- private.pode_aprovar()
CREATE OR REPLACE FUNCTION private.pode_aprovar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.status='ativo' and not p.primeiro_acesso
 and (p.perfil='administrador' or (p.perfil='lider' and p.pode_aprovar)));
$function$
;

-- public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer)
CREATE OR REPLACE FUNCTION public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.perfis%rowtype; novo uuid;
begin
 select * into v from public.perfis where id=p_ator for share;
 if not found or v.status<>'ativo' or v.primeiro_acesso or not
 (v.perfil='administrador' or (v.perfil='lider' and v.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if p_codigo_hash !~ '^[0-9a-f]{64}$' or p_dias not between 1 and 30 or p_usos_max not between 1 and 50 then
  raise exception 'PARAMETROS_INVALIDOS';
 end if;
 insert into public.convites(codigo_hash,criado_por,expira_em,usos_max)
 values(p_codigo_hash,p_ator,now()+make_interval(days=>p_dias),p_usos_max)
 returning id into novo;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,'convite_criado',novo,jsonb_build_object('dias',p_dias,'usos_max',p_usos_max));
 return novo;
end $function$
;

-- public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text)
CREATE OR REPLACE FUNCTION public.emitir_convite(p_ator uuid, p_codigo_hash text, p_dias integer, p_usos_max integer, p_codigo_curto_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.perfis%rowtype; novo uuid;
begin
 select * into v from public.perfis where id=p_ator for share;
 if not found or v.status<>'ativo' or v.primeiro_acesso or not
 (v.perfil='administrador' or (v.perfil='lider' and v.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if p_codigo_hash !~ '^[0-9a-f]{64}$' or p_codigo_curto_hash !~ '^[0-9a-f]{64}$'
  or p_dias not between 1 and 30 or p_usos_max not between 1 and 50 then
  raise exception 'PARAMETROS_INVALIDOS';
 end if;
 insert into public.convites(codigo_hash,codigo_curto_hash,criado_por,expira_em,usos_max)
 values(p_codigo_hash,p_codigo_curto_hash,p_ator,now()+make_interval(days=>p_dias),p_usos_max)
 returning id into novo;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,'convite_criado',novo,jsonb_build_object('dias',p_dias,'usos_max',p_usos_max,'codigo_curto',true));
 return novo;
end $function$
;

-- public.finalizar_cadastro(p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text)
CREATE OR REPLACE FUNCTION public.finalizar_cadastro(p_id uuid, p_usuario text, p_nome text, p_telefone text, p_codigo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.convites%rowtype; v_hash text;
begin
 v_hash:=encode(extensions.digest(p_codigo,'sha256'),'hex');
 select * into v from public.convites
 where codigo_hash=v_hash or codigo_curto_hash=v_hash for update;
 if not found or v.revogado or v.expira_em<=now() or v.usos>=v.usos_max then
  raise exception 'CONVITE_INVALIDO';
 end if;
 insert into public.perfis(id,usuario,nome,telefone,status,perfil)
 values(p_id,p_usuario,p_nome,p_telefone,'pendente','voluntario');
 update public.convites set usos=usos+1 where id=v.id;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_id,'cadastro_pendente',p_id,jsonb_build_object('convite_id',v.id));
end $function$
;

-- public.finalizar_primeiro_acesso(p_pessoa uuid)
CREATE OR REPLACE FUNCTION public.finalizar_primeiro_acesso(p_pessoa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 update public.perfis set primeiro_acesso=false where id=p_pessoa and primeiro_acesso=true;
 if not found then raise exception 'TROCA_NAO_NECESSARIA'; end if;
 insert into public.auditoria(quem,acao,alvo) values(p_pessoa,'senha_inicial_trocada',p_pessoa);
end $function$
;

-- public.gerir_pessoa(p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text)
CREATE OR REPLACE FUNCTION public.gerir_pessoa(p_ator uuid, p_pessoa uuid, p_perfil text, p_funcoes text[], p_pode_aprovar boolean, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ator public.perfis%rowtype;alvo public.perfis%rowtype;
begin
 select * into ator from public.perfis where id=p_ator for share;
 select * into alvo from public.perfis where id=p_pessoa for update;
 if ator.id is null or ator.status<>'ativo' or ator.primeiro_acesso or ator.perfil<>'administrador' then
  raise exception 'SEM_PERMISSAO';
 end if;
 if alvo.id is null or alvo.status not in ('ativo','desativado') or
  p_perfil not in ('administrador','lider','voluntario') or
  p_status not in ('ativo','desativado') or
  (p_pode_aprovar and p_perfil<>'lider') or
  exists(select 1 from unnest(coalesce(p_funcoes,'{}'::text[])) x
   where x not in ('professor','auxiliar','lanche','portaria')) then
  raise exception 'ALTERACAO_INVALIDA';
 end if;
 if p_ator=p_pessoa and (p_perfil<>'administrador' or p_status<>'ativo') then
  raise exception 'NAO_ALTERAR_PROPRIA_ADMINISTRACAO';
 end if;
 if alvo.perfil='administrador' and (p_perfil<>'administrador' or p_status<>'ativo')
  and (select count(*) from public.perfis where perfil='administrador' and status='ativo')<=1 then
   raise exception 'PRESERVAR_ADMINISTRADOR';
 end if;
 update public.perfis set perfil=p_perfil,pode_aprovar=p_pode_aprovar,status=p_status where id=p_pessoa;
 delete from public.funcoes_pessoa where pessoa_id=p_pessoa;
 insert into public.funcoes_pessoa(pessoa_id,funcao)
 select p_pessoa,x from (select distinct unnest(coalesce(p_funcoes,'{}'::text[])) x) q;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,'pessoa_atualizada',p_pessoa,
 jsonb_build_object('perfil_anterior',alvo.perfil,'perfil_novo',p_perfil,
 'status_anterior',alvo.status,'status_novo',p_status,'pode_aprovar',p_pode_aprovar));
end $function$
;

-- public.limitar_cadastro(p_chave text)
CREATE OR REPLACE FUNCTION public.limitar_cadastro(p_chave text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if p_chave !~ '^[0-9a-f]{64}$' then return false; end if;
 insert into private.limites_cadastro as atual(chave,janela,tentativas)
 values(p_chave,now(),1)
 on conflict(chave) do update set
 tentativas=case when atual.janela<now()-interval '1 hour' then 1 else atual.tentativas+1 end,
 janela=case when atual.janela<now()-interval '1 hour' then now() else atual.janela end
 returning tentativas into n;
 return n<=20;
end $function$
;

-- public.revisar_cadastro(p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text, p_funcoes text[], p_pode_aprovar boolean)
CREATE OR REPLACE FUNCTION public.revisar_cadastro(p_ator uuid, p_pessoa uuid, p_aprovar boolean, p_perfil text DEFAULT 'voluntario'::text, p_funcoes text[] DEFAULT '{}'::text[], p_pode_aprovar boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ator public.perfis%rowtype; alvo public.perfis%rowtype;
begin
 select * into ator from public.perfis where id=p_ator for share;
 select * into alvo from public.perfis where id=p_pessoa for update;
 if ator.id is null or ator.status<>'ativo' or ator.primeiro_acesso or not
 (ator.perfil='administrador' or (ator.perfil='lider' and ator.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if alvo.id is null or alvo.status<>'pendente' then raise exception 'CADASTRO_NAO_PENDENTE'; end if;
 if p_aprovar then
  if p_perfil not in ('administrador','lider','voluntario') or
  (p_perfil='administrador' and ator.perfil<>'administrador') or
  (p_pode_aprovar and (p_perfil<>'lider' or ator.perfil<>'administrador')) or
  exists (select 1 from unnest(coalesce(p_funcoes,'{}'::text[])) x
   where x not in ('professor','auxiliar','lanche','portaria')) then
   raise exception 'PERFIL_OU_FUNCOES_INVALIDOS';
  end if;
  update public.perfis set status='ativo',perfil=p_perfil,pode_aprovar=p_pode_aprovar,aprovado_por=p_ator,aprovado_em=now()
    where id=p_pessoa;
  insert into public.funcoes_pessoa(pessoa_id,funcao)
    select p_pessoa,x from (select distinct unnest(coalesce(p_funcoes,'{}'::text[])) x) q;
 else
  update public.perfis set status='recusado',aprovado_por=p_ator,aprovado_em=now()
   where id=p_pessoa;
 end if;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values(p_ator,case when p_aprovar then 'cadastro_aprovado' else 'cadastro_recusado' end,
 p_pessoa,jsonb_build_object('perfil',case when p_aprovar then p_perfil else null end));
end $function$
;

-- public.revogar_convite(p_ator uuid, p_convite uuid)
CREATE OR REPLACE FUNCTION public.revogar_convite(p_ator uuid, p_convite uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.perfis%rowtype;c public.convites%rowtype;
begin
 select * into a from public.perfis where id=p_ator for share;
 select * into c from public.convites where id=p_convite for update;
 if a.id is null or a.status<>'ativo' or a.primeiro_acesso or not
 (a.perfil='administrador' or (a.perfil='lider' and a.pode_aprovar)) then
  raise exception 'SEM_PERMISSAO';
 end if;
 if c.id is null then raise exception 'CONVITE_NAO_ENCONTRADO'; end if;
 update public.convites set revogado=true where id=p_convite;
 insert into public.auditoria(quem,acao,alvo) values(p_ator,'convite_revogado',p_convite);
end $function$
;
```
