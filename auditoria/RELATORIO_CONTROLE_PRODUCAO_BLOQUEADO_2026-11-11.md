# ⚠️ NÃO PRONTO — Escala Kids v1.2.3 — situação da publicação controlada

**Data:** 11/11/2026  
**Produção:** Supabase `pntzfuxwkjreugxzovjj`, site GitHub Pages `gabriellve800-star.github.io/Escala-Kids-/`.  
**QA:** `eofoeijyfpptcktiqeah`. **Nenhuma mudança realizada em produção.**

## 1. Resumo (3 linhas)

A função antiga v5 foi testada no QA após a migration nova, com cadastro, aprovação, login e limpeza aprovados.
A v1.2.3 passou 75/75 testes e 12/12 testes de navegador; 19 eventos de erro do QA foram auditados sem valores pessoais nos logs.
A publicação de produção permanece BLOQUEADA: o GitHub Actions não possui `PROD_SUPABASE_SECRET_KEY`, necessário para testar e limpar contas sintéticas reais imediatamente após o deploy.

## 2. Testes, resultados e evidências

| Teste | Resultado | Evidência |
|---|---|---|
| Função v5 contra migration nova | ✅ PASSOU | [Workflow legado](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088223989): QR longo, curto, registro pendente, aprovação, login, RLS, limpeza e restauração da candidata QA |
| Bateria principal candidata v1.2.3 | ✅ PASSOU | [Workflow QA](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088738686): **75/75** unitários/HTTP, **12/12** navegadores, limpeza zero |
| Log sanitizado do QA | ✅ INSPECIONADO | Consulta `function_logs` em 11/11, **19 eventos após 19:37 UTC**; todos têm `request_id`, `stage`, `field`, `code`; sem senha, e-mail, telefone, nome, código de convite ou token nos eventos analisados |
| Migration destinada à produção | ✅ INSPECIONADA | Arquivo exclusivo `supabase/migrations/20261111193000_prod_limite_rede_compartilhada.sql` na branch release; somente nova assinatura do limitador e grants, SEM `qa_limpar_limites` |
| Smoke público — limpeza por IDs exatos | ✅ TESTE ESTÁTICO | Identidades sintéticas pré-registradas por e-mail exato; deleção apenas de IDs obtidos dessas identidades; nenhuma deleção por prefixo amplo |
| Contratos estáticos de release | ✅ 5/5 | [GitHub Actions](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43091573880): migração mínima, logs, versão, cache, limpeza exclusiva e workflow |
| Chave necessária para teste de produção | ❌ AUSENTE | [GitHub Actions preflight](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43089540688): `PROD_SMOKE_SECRET_AUSENTE` (interrompido antes de qualquer alteração) |
| Contas, perfis e convites produção | ✅ BASELINE preservado | Duas consultas: **Auth 1, perfis 1, convites 4**; auditoria 8; `main` antigo e Edge v5 ativos |
| Migration / função / site em produção | ⚠️ NÃO EXECUTADOS | Bloqueio preventivo: sem conta sintética e limpeza comprováveis após deploy |
| Hashes, SW e E2E no endereço público atualizado | ⚠️ NÃO EXECUTADOS | Necessitam publicação autorizada e credencial de smoke real |
| Limpeza final em produção pós-smoke | ⚠️ NÃO EXECUTADA | Nenhum dado sintético foi criado; base permaneceu com totais originais |

## 3. NÃO VERIFICADO

- **CRÍTICO:** deploy e teste do candidato v1.2.3 no endereço público, inclusive versão, hashes, cache, cadastro, aprovação e limpeza pós-publicação.
- **CRÍTICO:** teste de falha e reversão automatizada simultânea de Edge e GitHub Pages na produção. A fonte antiga v5 está preservada e o rollback foi provado no QA.
- Dispositivos físicos iOS e Android: não solicitados antes do smoke público.

## 4. Riscos remanescentes

O risco principal é implantar uma versão sem dispor da credencial para conferir e remover contas sintéticas da produção. Por isso, **não aplicar a migration isoladamente** e não iniciar a publicação até o bloqueio ser removido. O GitHub mantém o [PR #1 em rascunho](https://github.com/gabriellve800-star/Escala-Kids-/pull/1). O token pessoal da organização usado no QA não substitui a chave secreta específica do projeto de produção.

## 5. Única ação necessária neste ponto

No GitHub do Escala Kids, em [Settings → Secrets and variables → Actions](https://github.com/gabriellve800-star/Escala-Kids-/settings/secrets/actions), criar Secret `PROD_SUPABASE_SECRET_KEY` com a **secret key** do projeto **Escala Kids de PRODUÇÃO** (Dashboard do Supabase → Escala Kids → Project Settings → API Keys → Secret keys, valor `sb_secret_...`). NÃO usar a chave do projeto Teste escala. NÃO colar chave no chat.

Após isso, o pipeline de smoke poderá ser executado, com limpeza somente de IDs sintéticos e confronto das contagens antes/depois.

## 6. Estado

- **✅ QA APROVADO:** compatibilidade v5 e 75/75 + 12/12; logs sanitizados.
- **⚠️ NÃO PRONTO para publicação:** falta chave de smoke no cofre GitHub, além das verificações pós-publicação. Produção não alterada. **Não fornecer roteiro de celular nesta etapa.**

### Artefatos

- [PR de lançamento controlado](https://github.com/gabriellve800-star/Escala-Kids-/pull/1) — rascunho
- [Workflow de smoke público](https://github.com/gabriellve800-star/Escala-Kids-/blob/release/escala-kids-v1.2.3/.github/workflows/prod-public-smoke.yml)
- [Smoke com limpeza de IDs exatos](https://github.com/gabriellve800-star/Escala-Kids-/blob/release/escala-kids-v1.2.3/testes/prod-smoke.cjs)
- [Plano de rollback](https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/auditoria/PLANO_RELEASE_ROLLBACK_V123.md)
