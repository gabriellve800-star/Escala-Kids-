# Escala Kids · Fase 3 · PR 2 (v1.2.6)
Data: 12/11/2026 · **PR draft, sem merge**.

## Implantação e limites
- **Branch** `feature/fase3-pr2-cadastro-familias`; referência `main` v1.2.5 + Fase 3 PR1.
- Banco de homologação Supabase **Teste escala**: `eofoeijyfpptcktiqeah`. SQL aplicado apenas aqui, com validação.
- Banco de produção **Escala Kids**: `pntzfuxwkjreugxzovjj`. **Nenhuma alteração em produção** neste PR.
- Nenhuma criança, família, termo ou turma real cadastrados. Testes com famílias e crianças fictícias foram revertidos via `ROLLBACK`.
- O frontend será v1.2.6 *somente após aprovação e merge*, mantendo layout/tokens, convite, login e agenda existentes.

## Entregas
1. **Turmas**: quatro posições, nomes e faixas em meses personalizáveis. Somente administrador e voluntários com permissão específica gerenciam, conforme cadastro da pessoa. UUID permanente, independente de nomes.
2. **Permissões**: concessão/revogação no cadastro de voluntários (confirmada e auditada), sem ampliar RLS de crianças fora da turma ou de saúde.
3. **Famílias**: entrada própria, convite de 256 bits separado dos convites ministeriais, token apenas em hash, tentativa limitada, email confirmado via Supabase Auth, equipe aprova. Não transformamos pais em perfil voluntário.
4. **Crianças**: cadastro pela família → `aguardando_equipe`; cadastro pela equipe → `consentimento_pendente`. Vínculo confirmado por equipe; confirmação do responsável na segunda origem; ANAD único/imutável do banco.
5. **Consentimento**: `private.termos_kids`; texto e versão a serem fornecidos pelo proprietário. Sem versão ativa **nenhuma criança pode ser cadastrada**, nem por ADMIN. No cadastro pela família exige `p_aceite=true` no servidor, além do checkbox.
6. **Portal da família**: consulta apenas próprios filhos, solicitações LGPD de acesso/correção/revogação/exclusão, inclusive para família ainda pendente. Sem telefone nem nomes de voluntários, sem fotos, sem informações clínicas.
7. **Agenda**: quando existirem turmas oficiais, o líder seleciona turma UUID e grava escala + mapeamento atomicamente. O modo legado por texto permanece enquanto não houver turmas configuradas, **sem** acesso infantil.
8. **Segurança**: funções privilegiadas da nova fase movidas ao schema `private`. API pública apenas `SECURITY INVOKER`; escrita declarada `VOLATILE`. Tabelas privadas de saúde, VAPID/push, termos e convites mantêm RLS, sem acesso direto do cliente. Respostas atrasadas de conta antiga não sobrescrevem dados de sessão nova; estado infantil limpo ao sair/trocar conta.

## Arquivos do PR
- Migrações:
  - `20261112203000_fase3_pr2_cadastro_transacional.sql`
  - `20261112204500_fase3_pr2_familia_pendente_rls.sql`
  - `20261112210000_fase3_pr2_escala_id_turma.sql`
  - `20261112211500_fase3_pr2_private_rpc_hardening.sql`
  - `20261112213000_fase3_pr2_solicitacoes_lgpd.sql`
- Teste SQL: `supabase/tests/fase3_pr2_flows_rollback.sql`.
- Módulos/UX: `app.js`, `kids-ui.js`, `agenda.js`, `styles.css`, `index.html`, `sw.js`.
- Testes JS: `testes/fase3-pr2.test.cjs` + regressões pré-existentes; QA version `1.2.6-qa`.

## Evidências comprovadas
- Teste SQL integrado com Auth sintético, permissões e RLS: `PR2_FICTICIO_TRANSACIONAL_OK` após `ROLLBACK` no projeto **Teste escala**.
- Família A não vê filho B; voluntário não vê crianças; grupo de acesso não herda dados de saúde; criança sem termo/sem aceite negada; aprovação/vínculo pelos lados corretos; admin publica escala atomizada, voluntário não publica.
- Supabase Security Advisor de homologação: **0 achados** após mover funções privileged para `private`.
- Testes automáticos de código: rodar `npm test` e consultar CI `Escala Kids — QA PR v1.2.5` no PR antes de aprovar.
- Não executados: teste com SMTP de email real/URL Auth confirmada, conta real de família, Android/iOS físico, navegação visual completa autenticada, teste de carga/abuso, termos LGPD aprovados.

## Pendências bloqueadoras antes do piloto
- **Texto integral e versão do termo** precisam ser entregues pelo proprietário; nenhum termo foi inventado ou inserido.
- Validar redirect URLs de Email Auth, confirmação de e-mail, CAPTCHA/anti-bot e políticas de signup no projeto de testes.
- A configuração de **Leaked Password Protection** do Auth de produção ainda está desabilitada segundo Security Advisor. Configurar no Dashboard Supabase **Authentication → Providers → Email**, conforme [documentação de segurança](https://supabase.com/docs/guides/auth/password-security). Essa funcionalidade pode exigir o plano Pro; **não foi alterada via conector**.
- Revisar RLS com tokens de usuários reais de teste, gestão de dispositivos e recuperação de conta; se necessário, implantar métodos adicionais e ajustar tempo de expiração do JWT.
- Acesso clínico auditado, formulários de condições/alergias, presença e lista de emergência, chamadas, Web Push, retirada, reservas/escalonamento continuam fora deste PR. Para presença/escalonamento/retirada, exigem decisões específicas do proprietário.
- Correção de ficha pelo responsável está implementada como **solicitação LGPD**, ainda não como edição direta; procedimento de exclusão também precisa de definição operacional/retention.
- Migrations do PR2 foram aplicadas em QA por SQL direto. **Histórico `supabase_migrations` QA não foi sincronizado**; antes de `db push` nesse mesmo projeto é obrigatória reconciliação por CLI oficial ou reconstrução controlada. Jamais repetir os SQLs à força.

**Critério de publicação:** PR validado, teste de Auth/RLS com contas sintéticas no app, termo fornecido, Security Advisor auditado, plano de rollback e autorização explícita. NÃO usar dados reais de menores até isso acontecer.
