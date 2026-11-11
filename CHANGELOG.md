# Changelog — Escala Kids

## QA 11/11/2026 — pendente de homologação

- Iniciada bateria automática para validar o formulário e o contrato do backend.
- Dois defeitos sob investigação: rollback sem checagem e limitação compartilhada por IP.
- O cadastro ponta a ponta ainda não foi reproduzido por HTTP com conta sintética: NÃO VERIFICADO.
- Nenhuma mudança do aplicativo destinada ao público será chamada de pronta sem evidências.

## v1.2.2 (estado existente)

- Formulário com mensagens por campo e preservação de dados após erro.
- QR e código curto para convite.


## 11/11/2026 — QA E2E isolado (ainda não publicado)

- Acrescentado `.github/workflows/qa-supabase-e2e.yml` (Secrets, migrations, deploy QA, unitários, E2E real, Playwright, rate limit e limpeza).
- Nova migration QA completa com RLS, grants, índices e funções, e migration QA do rate limit por IP.
- `/testes/qa-e2e.cjs`: admin sintético, convite longo/curto, pending, aprovação, recusa, login, duplicidades, concorrência, RLS com JWT pendente/recusado, 429 e zero resíduos.
- `/testes/qa-ui.spec.cjs`: Android Chromium e iPhone WebKit, fluxos de QR/código, validação, toque duplo, offline, SW; pós-checagem no banco.
- Backend QA: distingue códigos de erro do Auth (`email_exists`, `weak_password`, outros), rollback com delete+consulta, limite por IP + código e mensagens sanitizadas com ID de correlação.
- Testes RED anterior: e-mail com emoji, local-part >64 e pontos duplicados passavam; corrigidos em frontend e backend.
- Produção inalterada. O workflow E2E falha no preflight enquanto o projeto QA/Secrets não forem configurados; isso não é aprovação.
