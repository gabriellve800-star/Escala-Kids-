# ⚠️ NÃO PRONTO PARA PRODUÇÃO — QA Escala Kids aprovado

**Data:** 11/11/2026 · **Projeto QA:** Teste escala · **Workflow:** [GitHub Actions run 43081560210](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43081560210) · **Commit testado:** `42a940dfeb06f44d5b0fc24a22a0f61f147b99fd`.

## 1. Resumo em três linhas

As correções do cadastro por convite, mensagens por campo, rollback e limites compartilhados estão isoladas na branch `qa/convites-20261111`.
O GitHub Actions executou os testes **contra a função real do Supabase de TESTE**: 61 testes locais/HTTP, 12 testes Playwright, cadastros reais, aprovação, recusa, JWT real e concorrência; todos passaram.
O workflow encerrou com **zero resíduos**, conferidos novamente no banco QA; a **produção permanece v1.2.2 / kids-auth v5** e não foi alterada.

## 2. Resultados com evidências

| Teste | Resultado | Evidência no workflow |
|---|---|---|
| Migrações e função do projeto Teste escala | ✅ PASSOU | `Migrations` e `Implantar Edge Function` concluídos; função `kids-auth` QA v3 ACTIVE |
| Unitários, validações e HTTP negativo | ✅ **61/61** | `# tests 61`, `# pass 61`, `# fail 0`, `# skipped 0` |
| Administrador em QA e convite por QR longo e código curto | ✅ PASSOU | `QA PASS: geração de convite e validação real por QR longo e código curto` |
| `register` contra função real | ✅ PASSOU | `Auth +1, pendente, convite +1, auditoria +1` |
| Aprovar, atribuir funções, login | ✅ PASSOU | `QA PASS: aprovado: funções atribuídas, login por usuário e RLS ativo` |
| Recusar e bloquear pendente/recusado com JWT real | ✅ PASSOU | `QA PASS: RLS e escrita proibida para pendente/recusado` |
| E-mail e usuário duplicado, sem conta órfã | ✅ PASSOU | `QA PASS: duplicidades e-mail e nome de usuário sem resíduo Auth` |
| Concorrência em convite de 1 uso | ✅ PASSOU | `exatamente um sucesso, zero órfãos` |
| Campos inválidos, convite vencido, revogado, usado, origem e corpo malformado | ✅ PASSOU | `QA PASS: campos inválidos, convite vencido/revogado/usado, corpo e origem não autorizada` |
| Android/Chrome + iPhone/WebKit emulados | ✅ **12/12** | `12 passed (42.3s)`: QR, código, senha fraca, toque duplo, offline e SW |
| Persistência de cadastros feitos pela interface | ✅ **10/10** | `QA PASS: 10 cadastros de Chrome/WebKit confirmados no Auth, perfis pendentes, convite usado e auditoria` |
| Limites por IP | ✅ PASSOU | `25 validações na mesma rede/IP sem bloqueio`; `429 no limite por código` |
| Limpeza do QA | ✅ **ZERO** | `QA PASS: LIMPEZA ZERO: Auth=0, perfis=0, convites=0, funções=0, auditoria=0, limites=0`; consulta independente repetida confirmou os seis zeros |
| Produção não modificada | ✅ CONFIRMADO | `main` `c3e866b58d8b187e5adc3b30d455cb880d92a3b9`; `kids-auth` produção v5 |

## 3. NÃO VERIFICADO

- **CRÍTICO PARA PUBLICAR EM PRODUÇÃO:** fluxo ponta a ponta **contra a versão pública após uma promoção controlada**, com rollback, limpeza e conferência da publicação GitHub Pages / cache de produção. Não houve promoção nesta etapa.
- Uso em dispositivos **Android e iOS físicos**: Playwright emulou Android Chromium e motor WebKit do iPhone, mas não possui aparelhos reais.
- Aviso push com aplicativo fechado: fora do escopo desta fase.

## 4. Riscos restantes

- As correções QA ainda não substituíram o código público; a falha relatada por voluntário pode continuar na versão de produção.
- O fluxo QA validou a função remota e um frontend efêmero local; o GitHub Pages público ainda precisa de smoke pós-deploy.
- Mantenha Secrets exclusivos de QA, nunca leve `sb_secret_` ao frontend, ao repositório ou a logs.

## 5. O que o administrador precisa testar em celular real

**Zero passos agora.** Não pedir testes a voluntários antes de concluir a publicação controlada e a verificação pública.

## 6. Estado

- **✅ QA APROVADO:** todos os testes críticos do ambiente de teste passaram. GitHub Actions **run 43081560210** com `conclusion=success`.
- **⚠️ NÃO PRONTO PARA USO EM PRODUÇÃO:** a versão pública continua antiga e o smoke de publicação em produção está **NÃO VERIFICADO**. Não afirmar que a versão pública foi corrigida.

### Rastreabilidade

- [Execução verde no GitHub Actions](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43081560210)
- [Código e testes executados na branch QA](https://github.com/gabriellve800-star/Escala-Kids-/tree/qa/convites-20261111)
- [Snapshot de permissões SQL e RLS](https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/auditoria/snapshot_permissoes_v122.md)
