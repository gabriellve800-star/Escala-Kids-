# ⚠️ NÃO PRONTO — Gate de publicação controlada v1.2.3 (11/11/2026)

## 1. Resumo em 3 linhas
O teste de reversão com a função **v5 original** passou no Supabase QA após a migration aditiva: convite, cadastro pendente, aprovação, login, RLS e limpeza.
A função candidata v1.2.3 passou nos testes unitários/HTTP e navegador; logs sanitizados foram inspecionados e o candidato de release possui rotina de limpeza por IDs exatos.
**Produção NÃO alterada:** o smoke público requer uma credencial exclusiva de produção ainda ausente dos GitHub Secrets; o preflight bloqueou a publicação.

## 2. Teste | resultado | evidência

| Teste | Resultado | Evidência |
|---|---|---|
| v5 antiga após migration de rate limit | ✅ PASSOU | [GitHub Actions 43088223989](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088223989) · registro `V5_ROLLBACK_QA_PASS` e cleanup zero |
| QA v1.2.3, HTTP real e browsers | ✅ PASSOU | [GitHub Actions 43088738686](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088738686) · 75/75 testes, 12 navegadores e limpeza ZERO |
| Estrutura de DB de produção x QA | ✅ Paridade na base comum | 5 tabelas; 31 colunas; 24 constraints; 16 índices; 4 RLS; 32 grants; 12 funções compartilhadas; 0 triggers. Duas funções adicionais no QA por design |
| Logs sanitizados em execução QA | ✅ PASSOU (amostra) | 38 eventos posteriores a 19:35 UTC contendo `request_id`, `stage`, `field`, `code`; nenhuma ocorrência dos padrões de senha/token/e-mail/telefone/nome de usuário sintético examinados |
| Migration candidata exclusiva para produção | ✅ Revisão estática | Somente sobrecarga `limitar_cadastro(text,integer)` e grants; sem `qa_limpar_limites`, sem tabelas criadas/apagadas. [PR em rascunho #1](https://github.com/gabriellve800-star/Escala-Kids-/pull/1) |
| Limpeza pós-smoke somente de identidades exatas | ✅ Revisão estática | O smoke pré-registra três identidades sintéticas e confere que não existem; resolve os IDs específicos e apaga por `.in('id',ids)`; não exclui indiscriminadamente por prefixo |
| Testes de contrato da release | ✅ **5/5** | [Actions 43091573880](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43091573880) |
| Secret de produção para smoke/limpeza | ❌ AUSENTE | [Preflight 43089540688](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43089540688), tentativa 2 falhou com `PROD_SMOKE_SECRET_AUSENTE`. Nenhuma conta foi criada |
| Migration, Edge, Pages v1.2.3 na produção | ⏸ NÃO INICIADO | Regra de segurança: não publicar sem conseguir realizar e limpar smoke sintético imediatamente |
| Smoke real no endereço público e hash/cache v1.2.3 | NÃO VERIFICADO | Não pode ser executado até publicação; publicação bloqueada corretamente |
| Limpeza zero resíduos em produção | NÃO VERIFICADO | Nenhuma conta sintética criada; script pronto e restrito por IDs exatos |

### Contagens reais anteriores à mudança

| Registro na produção | Antes | Depois (sem alteração) |
|---|---:|---:|
| `auth.users` | 1 | 1 |
| `perfis` | 1 | 1 |
| `convites` | 4 | 4 |
| `auditoria` | 8 | 8 |

Função produção: **kids-auth v5**; GitHub `main`: `c3e866b58d8b187e5adc3b30d455cb880d92a3b9`; site v1.2.2. Não houve implantação parcial, portanto nenhum rollback real foi necessário.

## 3. NÃO VERIFICADO

- **CRÍTICO:** fluxo cadastro/convite/aprovação/recusa/login na URL pública com backend v1.2.3, e limpeza sintética exata. Bloqueado por falta do Secret exclusivo do smoke de produção.
- **CRÍTICO:** hash HTTP, versão visível e cache do service worker da v1.2.3 *em produção*. Nunca publicada.
- Reversão real em produção (v5 + site antigo): códigos/fontes/commits preservados e reversão ensaiada no QA; teste em produção não feito.
- Uso em Android/iPhone físicos: deliberadamente pendente após smoke.

## 4. Riscos

A produção ainda roda v1.2.2/v5, logo não afirmar que defeito de cadastro foi resolvido. A ausência de Secret para Auth administrativo impediria a limpeza segura caso um deploy fosse iniciado. O teste de logs foi por amostra recente, não prova absoluta contra futuros vazamentos. Nenhum defeito corrigido foi comprovado como causa exata do HTTP 400 do voluntário.

## 5. Próxima ação necessária

Salvar somente no cofre do GitHub, **sem enviar aqui**, o Secret:
- Nome: `PROD_SUPABASE_SECRET_KEY`
- Valor: chave que começa em `sb_secret_` do **projeto Escala Kids PRODUÇÃO** `pntzfuxwkjreugxzovjj`, NÃO do `Teste escala`.

Página de inclusão: https://github.com/gabriellve800-star/Escala-Kids-/settings/secrets/actions
Chaves no projeto de produção: https://supabase.com/dashboard/project/pntzfuxwkjreugxzovjj/settings/api-keys

Quando estiver cadastrado, repetir preflight. Só então avançar na ordem migration → função → site, com checagens, reversão imediata em falha, smoke/limpeza no endereço público e relatório. **Não pedir teste de celular real ainda.**

## 6. Estado

**⚠️ NÃO PRONTO PARA USO PÚBLICO**. QA e teste de rollback aprovado, mas o gate da produção está legitimamente bloqueado; nenhum arquivo ou conta real foi alterado.

## Outros documentos

- [Plano completo de publicação e rollback](https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/auditoria/PLANO_RELEASE_ROLLBACK_V123.md)
- [Candidato em PR rascunho](https://github.com/gabriellve800-star/Escala-Kids-/pull/1)
- [Automação do smoke público](https://github.com/gabriellve800-star/Escala-Kids-/blob/release/escala-kids-v1.2.3/.github/workflows/prod-public-smoke.yml)
