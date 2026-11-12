-- Escala Kids | Fase 3, PR 1: estrutura e isolamento. Aplicar SOMENTE em homologacao primeiro.
-- NAO instala contas, nao insere criancas, nao ativa Push nem altera as telas.
-- Acesso a saude e tokens de dispositivos: somente backend service_role; sem SELECT direto.
begin;

create table public.familias_kids (
  usuario_id uuid primary key references auth.users(id) on delete restrict,
  nome text not null check (char_length(btrim(nome)) between 3 and 120),
  telefone text,
  email_confirmado_em timestamptz,
  telefone_confirmado_em timestamptz,
  status text not null default 'pendente' check(status in ('pendente','ativo','desativado')),
  aprovado_por uuid references public.perfis(id) on delete restrict,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  check (telefone is null or telefone ~ '^\\+?[0-9]{10,15}$')
);

-- Identidade familiar e identidade de equipe nunca recebem autorizacao simultanea.
create or replace function private.equipe_ativa()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p where p.id=(select auth.uid())
      and p.status='ativo' and p.perfil in ('administrador','lider','voluntario')
      and not p.primeiro_acesso
      and not exists(select 1 from public.familias_kids f where f.usuario_id=p.id)
  );
$$;

create or replace function private.familia_ativa()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.familias_kids f where f.usuario_id=(select auth.uid())
    and f.status='ativo'
    and (f.email_confirmado_em is not null or f.telefone_confirmado_em is not null)
    and not exists(select 1 from public.perfis p where p.id=f.usuario_id)
  );
$$;

-- Refina helpers existentes sem alterar o resultado para usuarios atuais da equipe.
create or replace function private.ativo()
returns boolean language sql stable security definer set search_path = ''
as $$select private.equipe_ativa();$$;
create or replace function private.admin_ativo()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.equipe_ativa() and exists(
    select 1 from public.perfis where id=(select auth.uid()) and perfil='administrador'
  );
$$;
create or replace function private.lider_ativo()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.equipe_ativa() and exists(
    select 1 from public.perfis where id=(select auth.uid()) and perfil='lider'
  );
$$;
create or replace function private.pode_aprovar()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.equipe_ativa() and exists(
    select 1 from public.perfis p where p.id=(select auth.uid())
    and (p.perfil='administrador' or (p.perfil='lider' and p.pode_aprovar))
  );
$$;

-- O administrador delega capacidades no cadastro do voluntario (a futura UI vem no PR 2).
-- Permissoes administrativas nunca concedem visualizacao irrestrita ou saude direta.
create table public.permissoes_equipe_kids (
  pessoa_id uuid not null references public.perfis(id) on delete cascade,
  permissao text not null check(permissao in
    ('gerenciar_turmas','cadastrar_criancas','confirmar_cadastros',
     'gerenciar_vinculos','gerenciar_presencas','chamar_responsavel','consultar_saude')),
  concedida_por uuid not null references public.perfis(id) on delete restrict,
  concedida_em timestamptz not null default now(),
  primary key(pessoa_id,permissao)
);
create index idx_permissoes_concedida_por on public.permissoes_equipe_kids(concedida_por);

create or replace function private.tem_permissao_kids(p_permissao text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.equipe_ativa() and (
    private.admin_ativo()
    or exists(select 1 from public.permissoes_equipe_kids ep
       where ep.pessoa_id=(select auth.uid()) and ep.permissao=p_permissao)
  );
$$;

-- Quatro posicoes editaveis. Nenhum nome/idade inicial presumido.
create table public.turmas_kids (
  id uuid primary key default gen_random_uuid(),
  posicao smallint not null unique check(posicao between 1 and 4),
  nome text not null check(char_length(btrim(nome)) between 2 and 60),
  idade_min_meses smallint not null check(idade_min_meses between 0 and 215),
  idade_max_meses smallint not null check(idade_max_meses between 0 and 215),
  ativa boolean not null default true,
  alterada_em timestamptz not null default now(),
  check(idade_max_meses>=idade_min_meses)
);
create unique index uq_turmas_kids_nome on public.turmas_kids(lower(btrim(nome)));

-- Escalas antigas guardam a turma como TEXT. Mapeamento explicito para UUID:
-- ausencia do mapeamento => equipe SEM ACESSO a criancas; nunca comparar apenas nome.
create table public.escalas_turmas_kids (
  escala_id uuid primary key references public.escalas(id) on delete cascade,
  turma_id uuid not null references public.turmas_kids(id) on delete restrict,
  vinculada_por uuid not null references public.perfis(id) on delete restrict,
  vinculada_em timestamptz not null default now()
);
create index idx_escalas_turmas_kids_turma on public.escalas_turmas_kids(turma_id);

create table public.coberturas_kids (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid not null references public.turmas_kids(id) on delete restrict,
  dia date not null,
  culto text not null check(culto in ('domingo_manha','domingo_noite','quarta_noite')),
  expira_em timestamptz not null,
  concedida_por uuid not null references public.perfis(id) on delete restrict,
  concedida_em timestamptz not null default now(),
  check (
    (extract(isodow from dia)=7 and culto in ('domingo_manha','domingo_noite'))
    or (extract(isodow from dia)=3 and culto='quarta_noite')
  )
);
create index idx_coberturas_pessoa_dia on public.coberturas_kids(pessoa_id,dia,turma_id);

-- Permissao sempre amarrada a uma escala real do dia + culto + ID da turma.
-- Uma cobertura tem de ser concedida pela lideranca, por tempo limitado.
create or replace function private.escalada_turma_kids(p_turma uuid,p_culto text default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.equipe_ativa() and p_turma is not null and (
    exists(
      select 1 from public.escalas e
      join public.escalas_turmas_kids m on m.escala_id=e.id
      where e.pessoa_id=(select auth.uid()) and m.turma_id=p_turma
        and e.dia=(now() at time zone 'America/Sao_Paulo')::date
        and e.funcao in ('professor','auxiliar')
        and (p_culto is null or e.culto=p_culto)
    )
    or exists(
      select 1 from public.coberturas_kids c
      join public.perfis lider on lider.id=c.concedida_por
      where c.pessoa_id=(select auth.uid()) and c.turma_id=p_turma
        and c.dia=(now() at time zone 'America/Sao_Paulo')::date
        and c.expira_em>now()
        and (p_culto is null or c.culto=p_culto)
        and lider.status='ativo' and lider.perfil in ('administrador','lider')
        and not lider.primeiro_acesso
    )
  );
$$;

create or replace function private.portaria_hoje_kids(p_culto text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.equipe_ativa() and exists(
    select 1 from public.escalas e where e.pessoa_id=(select auth.uid())
    and e.dia=(now() at time zone 'America/Sao_Paulo')::date
    and e.culto=p_culto and e.funcao='portaria'
  );
$$;

-- Sequencia e identificacao sao do banco, NUNCA credenciais de acesso.
create table public.criancas_kids (
  id uuid primary key default gen_random_uuid(),
  numero_interno bigint generated always as identity (start with 1 increment by 1) unique,
  numero text generated always as (
    'ANAD-' || lpad(numero_interno::text,greatest(length(numero_interno::text),3),'0')
  ) stored unique,
  nome text not null check(char_length(btrim(nome)) between 2 and 120),
  nascimento date not null,
  turma_id uuid not null references public.turmas_kids(id) on delete restrict,
  origem text not null check(origem in ('equipe','familia')),
  status text not null check(status in
    ('aguardando_equipe','consentimento_pendente','ativo','inativo')),
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  alterado_em timestamptz not null default now(),
  inativado_em timestamptz,
  excluir_apos date
);
create index idx_criancas_turma_status on public.criancas_kids(turma_id,status);
create index idx_criancas_criador on public.criancas_kids(criado_por);

create or replace function private.imutavel_anad_kids()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.numero_interno is distinct from old.numero_interno then
    raise exception 'IDENTIFICADOR_IMUTAVEL';
  end if;
  return new;
end $$;
create trigger trg_anad_nao_editar before update on public.criancas_kids
for each row execute function private.imutavel_anad_kids();

create table public.vinculos_kids (
  id uuid primary key default gen_random_uuid(),
  crianca_id uuid not null references public.criancas_kids(id) on delete cascade,
  responsavel_id uuid not null references public.familias_kids(usuario_id) on delete restrict,
  parentesco text not null check(char_length(btrim(parentesco)) between 2 and 50),
  status text not null default 'pendente' check(status in ('pendente','confirmado','revogado')),
  confirmado_por uuid references public.perfis(id) on delete restrict,
  confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique(crianca_id,responsavel_id)
);
create index idx_vinculos_responsavel on public.vinculos_kids(responsavel_id,status);

create or replace function private.familia_vinculada_kids(p_crianca uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.familia_ativa() and exists(
    select 1 from public.vinculos_kids v where v.crianca_id=p_crianca
    and v.responsavel_id=(select auth.uid()) and v.status='confirmado'
  );
$$;

create table public.consentimentos_kids (
  id uuid primary key default gen_random_uuid(),
  crianca_id uuid not null references public.criancas_kids(id) on delete cascade,
  responsavel_id uuid not null references public.familias_kids(usuario_id) on delete restrict,
  finalidade text not null check(finalidade in ('cadastro','saude','alertas')),
  versao_termo text not null check(char_length(versao_termo) between 1 and 50),
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz,
  unique(crianca_id,responsavel_id,finalidade,versao_termo)
);
create index idx_consentimentos_crianca on public.consentimentos_kids(crianca_id);

-- Dados clinicos em schema NAO exposto e sem grant/policy para usuarios.
create table private.saude_kids (
  crianca_id uuid primary key references public.criancas_kids(id) on delete cascade,
  alergias text,
  condicoes text,
  observacoes text,
  revisado_por uuid references auth.users(id) on delete restrict,
  revisado_em timestamptz not null default now()
);

create table public.presencas_kids (
  id uuid primary key default gen_random_uuid(),
  crianca_id uuid not null references public.criancas_kids(id) on delete restrict,
  dia date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  culto text not null check(culto in ('domingo_manha','domingo_noite','quarta_noite')),
  turma_id uuid not null references public.turmas_kids(id) on delete restrict,
  estado text not null default 'presente' check(estado in ('presente','saiu')),
  entrada_em timestamptz not null default now(),
  saida_em timestamptz,
  operador_id uuid not null references public.perfis(id) on delete restrict,
  unique(crianca_id,dia,culto),
  check(
    (extract(isodow from dia)=7 and culto in ('domingo_manha','domingo_noite'))
    or (extract(isodow from dia)=3 and culto='quarta_noite')
  )
);
create index idx_presencas_dia_turma on public.presencas_kids(dia,culto,turma_id);

create table public.chamados_kids (
  id uuid primary key default gen_random_uuid(),
  presenca_id uuid not null references public.presencas_kids(id) on delete restrict,
  responsavel_id uuid not null references public.familias_kids(usuario_id) on delete restrict,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  motivo text check(motivo in ('choro','febre','banheiro','comportamento','quer_ir_embora','outro')),
  status text not null default 'enviado' check(status in
    ('enviado','visto','a_caminho','resolvido','sem_resposta','cancelado')),
  criado_em timestamptz not null default now(),
  visto_em timestamptz,
  a_caminho_em timestamptz,
  resolvido_em timestamptz,
  sem_resposta_em timestamptz,
  cancelado_em timestamptz
);
create unique index uq_chamado_aberto_presenca on public.chamados_kids(presenca_id)
where status in ('enviado','visto','a_caminho');
create index idx_chamados_responsavel on public.chamados_kids(responsavel_id,criado_em desc);

create table public.dispositivos_familia_kids (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null references public.familias_kids(usuario_id) on delete cascade,
  apelido text not null check(char_length(btrim(apelido)) between 1 and 64),
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);
create index idx_dispositivos_responsavel on public.dispositivos_familia_kids(responsavel_id);
create table private.assinaturas_push_kids (
  dispositivo_id uuid primary key references public.dispositivos_familia_kids(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  atualizado_em timestamptz not null default now()
);

create table private.convites_familia_kids (
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null unique check(codigo_hash ~ '^[0-9a-f]{64}$'),
  criado_por uuid not null references public.perfis(id) on delete restrict,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usos_max integer not null check(usos_max between 1 and 20),
  usos integer not null default 0 check(usos>=0),
  revogado boolean not null default false,
  check(usos<=usos_max)
);

create table public.solicitacoes_privacidade_kids (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null references public.familias_kids(usuario_id) on delete restrict,
  crianca_id uuid references public.criancas_kids(id) on delete restrict,
  tipo text not null check(tipo in ('acesso','correcao','exclusao','revogacao')),
  status text not null default 'pendente' check(status in ('pendente','em_analise','concluida')),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index idx_solicitacoes_responsavel on public.solicitacoes_privacidade_kids(responsavel_id);

create table private.retencao_kids (
  unico boolean primary key default true check(unico),
  dias_apos_inativacao integer check(dias_apos_inativacao between 1 and 3650),
  atualizado_em timestamptz not null default now()
);
-- Nenhuma limpeza automatica ate configuracao aprovada.

-- Autorizacoes de leitura clinica sao sempre executadas por backend autenticado
-- com revalidacao de vinculo/escala e INSERT obrigatorio em public.auditoria.
-- Este PR intencionalmente NAO publica RPC de saude nem aceita escrita direta.

-- Policies basicas: funcionarios sem autorizacao nao veem familias ou filhos.
create or replace function private.pode_ver_crianca_kids(p_crianca uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.admin_ativo() or private.lider_ativo()
    or private.familia_vinculada_kids(p_crianca)
    or exists(
      select 1 from public.criancas_kids c where c.id=p_crianca and c.status='ativo'
        and private.escalada_turma_kids(c.turma_id)
    )
    or exists(
      select 1 from public.criancas_kids c where c.id=p_crianca
        and c.criado_por=(select auth.uid()) and c.origem='familia'
        and c.status='aguardando_equipe' and private.familia_ativa()
    );
$$;

-- Privilegio de esquema e TABELA: revogar ANTES de conceder acesso minimo.
revoke all on public.familias_kids,public.permissoes_equipe_kids,public.turmas_kids,
 public.escalas_turmas_kids,public.coberturas_kids,public.criancas_kids,
 public.vinculos_kids,public.consentimentos_kids,public.presencas_kids,
 public.chamados_kids,public.dispositivos_familia_kids,public.solicitacoes_privacidade_kids
 from public,anon,authenticated;
revoke all on private.saude_kids,private.assinaturas_push_kids,
 private.convites_familia_kids,private.retencao_kids from public,anon,authenticated;
revoke all on sequence public.criancas_kids_numero_interno_seq from public,anon,authenticated;

alter table public.familias_kids enable row level security;
alter table public.permissoes_equipe_kids enable row level security;
alter table public.turmas_kids enable row level security;
alter table public.escalas_turmas_kids enable row level security;
alter table public.coberturas_kids enable row level security;
alter table public.criancas_kids enable row level security;
alter table public.vinculos_kids enable row level security;
alter table public.consentimentos_kids enable row level security;
alter table public.presencas_kids enable row level security;
alter table public.chamados_kids enable row level security;
alter table public.dispositivos_familia_kids enable row level security;
alter table public.solicitacoes_privacidade_kids enable row level security;
alter table private.saude_kids enable row level security;
alter table private.assinaturas_push_kids enable row level security;
alter table private.convites_familia_kids enable row level security;
alter table private.retencao_kids enable row level security;

-- Sem policies em tabelas private: nenhuma leitura direta inclusive se um GRANT
-- acidental for feito mais tarde. SERVICE_ROLE acessa no backend apenas.
create policy familia_ler_propria on public.familias_kids for select to authenticated
using ((select private.admin_ativo()) or
  ((select private.familia_ativa()) and usuario_id=(select auth.uid())));
grant select on public.familias_kids to authenticated;

create policy permissoes_ler on public.permissoes_equipe_kids for select to authenticated
using ((select private.admin_ativo()) or
  ((select private.equipe_ativa()) and pessoa_id=(select auth.uid())));
create policy permissoes_inserir_admin on public.permissoes_equipe_kids for insert to authenticated
with check ((select private.admin_ativo()) and concedida_por=(select auth.uid())
  and exists(select 1 from public.perfis p
    where p.id=pessoa_id and p.status='ativo' and p.perfil in ('voluntario','lider')
    and not p.primeiro_acesso));
create policy permissoes_revogar_admin on public.permissoes_equipe_kids for delete to authenticated
using ((select private.admin_ativo()));
grant select,insert,delete on public.permissoes_equipe_kids to authenticated;

create policy turmas_ler on public.turmas_kids for select to authenticated
using ((select private.equipe_ativa()) or (select private.familia_ativa()));
create policy turmas_inserir on public.turmas_kids for insert to authenticated
with check ((select private.tem_permissao_kids('gerenciar_turmas')));
create policy turmas_editar on public.turmas_kids for update to authenticated
using ((select private.tem_permissao_kids('gerenciar_turmas')))
with check ((select private.tem_permissao_kids('gerenciar_turmas')));
-- Nao deletar turmas: somente desativacao para preservar historico.
grant select,insert,update on public.turmas_kids to authenticated;

create policy mapeamento_ler on public.escalas_turmas_kids for select to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo()));
create policy mapeamento_inserir on public.escalas_turmas_kids for insert to authenticated
with check (((select private.admin_ativo()) or (select private.lider_ativo()))
  and vinculada_por=(select auth.uid()));
create policy mapeamento_editar on public.escalas_turmas_kids for update to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo()))
with check (((select private.admin_ativo()) or (select private.lider_ativo()))
  and vinculada_por=(select auth.uid()));
create policy mapeamento_apagar on public.escalas_turmas_kids for delete to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo()));
grant select,insert,update,delete on public.escalas_turmas_kids to authenticated;

create policy cobertura_ler on public.coberturas_kids for select to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo())
  or ((select private.equipe_ativa()) and pessoa_id=(select auth.uid())));
create policy cobertura_criar on public.coberturas_kids for insert to authenticated
with check (((select private.admin_ativo()) or (select private.lider_ativo()))
  and concedida_por=(select auth.uid()) and expira_em>now()
  and expira_em<=now()+interval '24 hours' and dia=(now() at time zone 'America/Sao_Paulo')::date);
create policy cobertura_revogar on public.coberturas_kids for delete to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo()));
grant select,insert,delete on public.coberturas_kids to authenticated;

create policy criancas_ler on public.criancas_kids for select to authenticated
using (private.pode_ver_crianca_kids(id));
grant select on public.criancas_kids to authenticated;

create policy vinculos_ler on public.vinculos_kids for select to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo())
  or ((select private.familia_ativa()) and responsavel_id=(select auth.uid())));
grant select on public.vinculos_kids to authenticated;

create policy consentimentos_ler on public.consentimentos_kids for select to authenticated
using ((select private.admin_ativo())
  or ((select private.familia_ativa()) and responsavel_id=(select auth.uid())));
grant select on public.consentimentos_kids to authenticated;

create policy presencas_ler on public.presencas_kids for select to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo())
  or private.familia_vinculada_kids(crianca_id)
  or (dia=(now() at time zone 'America/Sao_Paulo')::date
      and private.escalada_turma_kids(turma_id,culto)));
grant select on public.presencas_kids to authenticated;

create policy chamados_ler on public.chamados_kids for select to authenticated
using ((select private.admin_ativo()) or (select private.lider_ativo())
  or ((select private.familia_ativa()) and responsavel_id=(select auth.uid()))
  or exists(select 1 from public.presencas_kids p where p.id=presenca_id
    and p.dia=(now() at time zone 'America/Sao_Paulo')::date
    and private.escalada_turma_kids(p.turma_id,p.culto)));
grant select on public.chamados_kids to authenticated;

create policy dispositivos_ler on public.dispositivos_familia_kids for select to authenticated
using ((select private.familia_ativa()) and responsavel_id=(select auth.uid()));
grant select on public.dispositivos_familia_kids to authenticated;

create policy privacidade_ler on public.solicitacoes_privacidade_kids for select to authenticated
using ((select private.admin_ativo())
  or ((select private.familia_ativa()) and responsavel_id=(select auth.uid())));
grant select on public.solicitacoes_privacidade_kids to authenticated;

-- Eventos de gestao: logs apenas IDs internos + tipo da alteracao.
create or replace function private.auditar_gestao_kids()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare alvo uuid; codigo text;
begin
 if TG_TABLE_NAME='permissoes_equipe_kids' then
   alvo=coalesce(new.pessoa_id,old.pessoa_id);
   codigo=coalesce(new.permissao,old.permissao);
 else
   alvo=coalesce(new.id,old.id);
   codigo='turma';
 end if;
 insert into public.auditoria(quem,acao,alvo,detalhes)
 values((select auth.uid()),'fase3_'||lower(TG_OP),alvo,
        pg_catalog.jsonb_build_object('tipo',codigo));
 return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger tr_permissoes_kids_audit after insert or delete on public.permissoes_equipe_kids
for each row execute function private.auditar_gestao_kids();
create trigger tr_turmas_kids_audit after insert or update on public.turmas_kids
for each row execute function private.auditar_gestao_kids();

-- SECURITY DEFINER em schema privado; EXECUTE restrito.
revoke all on function private.equipe_ativa(),private.familia_ativa(),
 private.tem_permissao_kids(text),private.escalada_turma_kids(uuid,text),
 private.portaria_hoje_kids(text),private.familia_vinculada_kids(uuid),
 private.pode_ver_crianca_kids(uuid),private.imutavel_anad_kids(),
 private.auditar_gestao_kids() from public,anon,authenticated;
grant execute on function private.equipe_ativa(),private.familia_ativa(),
 private.tem_permissao_kids(text),private.escalada_turma_kids(uuid,text),
 private.portaria_hoje_kids(text),private.familia_vinculada_kids(uuid),
 private.pode_ver_crianca_kids(uuid) to authenticated;

commit;
