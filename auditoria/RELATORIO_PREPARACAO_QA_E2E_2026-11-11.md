# ⚠️ NÃO PRONTO — Escala Kids QA E2E (11/11/2026)

## 1. Resumo (3 linhas)

A branch `qa/convites-20261111` tem migrations para Supabase TESTE, função `kids-auth` QA e workflow automático para Auth, RLS, aprovação, recusa, concorrência e Playwright.
As mudanças do backend QA incluem rollback com conferência, limite por IP + convite/usuário e mensagens `createUser` por código de erro; caso real rejeitado na validação antiga: `ana@🙂.com`.
O fluxo E2E inteiro ainda **não foi executado**, porque falta configurar os cinco Secrets do Supabase QA. Produção não foi alterada.

## 2. Testes e evidências

| Teste | Resultado | Evidência |
|---|---|---|
| Workflow criado na branch QA | PASSOU (configuração) | `.github/workflows/qa-supabase-e2e.yml` versionado, iniciado pelo GitHub |
| Trava de Secrets e produção | PASSOU | Execução 43068915610 recusou prosseguir: `FALTAM_SECRETS_QA`, antes de migrar/deployar qualquer banco |
| Testes unitários e sintaxe | PASSOU | GitHub run 43069347613: 57/57 testes, 0 falhas; checagem sintática de `app.js`, runner E2E e Playwright |
| Regressão e-mail inválido | PASSOU no ramo | Testes RED anteriores rejeitaram `ana@🙂.com`, e-mail com mais de 64 caracteres no local-part e pontos duplos; teste GREEN posterior 57/57 |
| Migrations Supabase QA | NÃO VERIFICADO | Arquivos criados; falta projeto QA real e Secrets para `supabase db push` |
| Deploy função QA | NÃO VERIFICADO | Código na branch, sem deployment possível até configurar projeto QA |
| Cadastro HTTP real e confirmação SQL | NÃO VERIFICADO | O workflow está escrito, mas guard bloqueou a execução por Secrets ausentes |
| Aprovação, recusa, login de aprovado | NÃO VERIFICADO | Dependem da primeira criação de conta sintética |
| JWT RLS pendente/recusado, proibição de INSERT/UPDATE | NÃO VERIFICADO | Implementados no script E2E; não executados contra QA |
| Duplicidade, rollback e concorrência | NÃO VERIFICADO | Testes implementados, faltam credenciais de QA |
| Limite IP compartilhado e 429 HTTP | NÃO VERIFICADO | Há prova SQL transacional anterior, mas ainda falta novo teste HTTP de QA |
| Playwright Android/Chrome + iPhone/WebKit | NÃO VERIFICADO | Scripts escritos, workflow não chegou à instalação dos navegadores |
| Limpeza zero resíduos após E2E | NÃO VERIFICADO | Rotina `finally` do Actions é obrigatória, mas não houve contas QA criadas |
| Estado da produção | SEM MUDANÇA | Apenas branch de QA recebeu commits; produção segue PWA v1.2.2 e função kids-auth v5 |

## 3. Não verificado (crítico)

Todas as etapas de E2E HTTP real, browser, privilégios com JWT real, concorrência, deploy e limpeza de contas sintéticas seguem pendentes, pelo mesmo motivo: **projeto/Secrets de QA ainda não conectados**.

As migrations foram geradas a partir do schema real, mas seu sucesso numa base vazia ainda não foi provado. O workflow foi desenhado para marcar a execução em vermelho se algum teste falhar. O método exige novo teste depois do deploy efetivo no QA e antes de promover.

## 4. Riscos

- A nova migration pode necessitar ajustes quando aplicada ao Supabase QA.
- O teste de navegador WebKit em Linux não é prova em iPhone físico.
- O teste e2e pode revelar outros bugs de Auth ou rollback ainda não reproduzidos.
- A produção não recebe mudanças automaticamente de QA; não houve publicação de correções do fluxo de convite.

## 5. O que precisa fazer

Criar um projeto **Escala Kids QA** no Supabase e salvar os **cinco Secrets de QA** descritos em `testes/CONFIGURAR_SUPABASE_QA.md`. Depois executar o workflow na branch QA, sem compartilhar nenhum valor no chat. Não realizar testes com voluntários reais.

## 6. Estado

**⚠️ NÃO PRONTO**. Nenhuma liberação de produção será realizada enquanto o workflow E2E não estiver inteiramente verde e a limpeza final não demonstrar zero resíduos.

### Links de prova

- Setup QA: https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/testes/CONFIGURAR_SUPABASE_QA.md
- Código/QA: https://github.com/gabriellve800-star/Escala-Kids-/tree/qa/convites-20261111
- Workflow QA: https://github.com/gabriellve800-star/Escala-Kids-/actions/workflows/qa-supabase-e2e.yml
- Execução bloqueada sem Secrets: https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43068915610
- Testes unitários: https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43069347613
