-- ESCALA KIDS v1.2.4 — mudança estritamente aditiva. Nunca alterar cadastro, login ou convites.
-- Disponibilidade pertence ao voluntário; gestão de escalas, exclusivamente à liderança ativa.
create table if not exists public.disponibilidades (
  pessoa_id uuid not null references public.perfis(id) on delete cascade,
  dia date not null,
  culto text not null check (culto in ('domingo_manha','domingo_noite','quarta_noite')),
  criado_em timestamptz not null default now(),
  constraint disponibilidades_pk primary key (pessoa_id,dia,culto),
  constraint disponibilidades_dia_culto check (
    (extract(isodow from dia)=7 and culto in ('domingo_manha','domingo_noite'))
    or (extract(isodow from dia)=3 and culto='quarta_noite')
  )
);
create index if not exists idx_disponibilidades_dia_culto on public.disponibilidades(dia,culto);

create table if not exists public.escalas (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.perfis(id) on delete cascade,
  dia date not null,
  culto text not null check (culto in ('domingo_manha','domingo_noite','quarta_noite')),
  horario time without time zone not null,
  turma text not null check (char_length(btrim(turma)) between 2 and 80),
  funcao text not null check (funcao in ('professor','auxiliar','lanche','portaria')),
  criado_em timestamptz not null default now(),
  unique(pessoa_id,dia,culto),
  constraint escalas_dia_culto check (
    (extract(isodow from dia)=7 and culto in ('domingo_manha','domingo_noite'))
    or (extract(isodow from dia)=3 and culto='quarta_noite')
  )
);
create index if not exists idx_escalas_pessoa_dia on public.escalas(pessoa_id,dia);
create index if not exists idx_escalas_dia_culto on public.escalas(dia,culto);

alter table public.disponibilidades enable row level security;
alter table public.escalas enable row level security;

create policy disponibilidades_leitura on public.disponibilidades
 for select to authenticated using (
   ((select private.ativo()) and pessoa_id=(select auth.uid()))
   or (select private.admin_ativo()) or (select private.lider_ativo())
 );
create policy disponibilidades_cadastrar_proximo_mes on public.disponibilidades
 for insert to authenticated with check (
   pessoa_id=(select auth.uid()) and (select private.ativo())
   and dia >= (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month')::date
   and dia <  (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '2 months')::date
 );
create policy disponibilidades_remover_proximo_mes on public.disponibilidades
 for delete to authenticated using (
   pessoa_id=(select auth.uid()) and (select private.ativo())
   and dia >= (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month')::date
   and dia <  (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '2 months')::date
 );
create policy escalas_leitura on public.escalas
 for select to authenticated using (
   ((select private.ativo()) and pessoa_id=(select auth.uid()))
   or (select private.admin_ativo()) or (select private.lider_ativo())
 );
create policy escalas_lider_inserir on public.escalas
 for insert to authenticated with check (
   ((select private.admin_ativo()) or (select private.lider_ativo()))
   and exists (
     select 1 from public.perfis p where p.id=pessoa_id and p.status='ativo' and not p.primeiro_acesso
   )
 );
create policy escalas_lider_editar on public.escalas
 for update to authenticated
 using ((select private.admin_ativo()) or (select private.lider_ativo()))
 with check (
   ((select private.admin_ativo()) or (select private.lider_ativo()))
   and exists (
     select 1 from public.perfis p where p.id=pessoa_id and p.status='ativo' and not p.primeiro_acesso
   )
 );
create policy escalas_lider_remover on public.escalas
 for delete to authenticated using ((select private.admin_ativo()) or (select private.lider_ativo()));

revoke all on public.disponibilidades,public.escalas from anon,authenticated;
grant select,insert,delete on public.disponibilidades to authenticated;
grant select,insert,update,delete on public.escalas to authenticated;
