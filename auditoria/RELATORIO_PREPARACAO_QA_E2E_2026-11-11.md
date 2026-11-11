# ⚠️ NÃO PRONTO — Escala Kids: Homologação QA (11/11/2026)

## 1. Resumo em três linhas

O projeto separado **Teste escala** foi localizado no Supabase (ref `eofoeijyfpptcktiqeah`), e as duas migrations foram aplicadas com sucesso.
A Edge Function `kids-auth` v1 foi implantada no projeto QA, com RLS habilitado nas quatro tabelas públicas e zero alertas no Security Advisor.
O E2E completo depende apenas de cadastrar **três GitHub Secrets privados**; não houve nenhuma alteração no projeto público.

## 2. Testes e evidências

| Teste | Resultado | Evidência |
|---|---|---|
| Projeto QA isolado | ✅ Confirmado | Ref `eofoeijyfpptcktiqeah` versus produção `pntzfuxwkjreugxzovjj`; organização igual, projeto próprio |
| Migrations QA | ✅ Aplicadas | Supabase `list_migrations`: `20261111174456 qa_schema_escala_kids_v122`; `20261111174505 qa_limitador_rede_compartilhada` |
| Banco pronto para testes | ✅ Estrutura comprovada | Tabelas `perfis`, `convites`, `funcoes_pessoa`, `auditoria`; 4 com RLS ativo |
| Grants de ações privilegiadas | ✅ Inspecionados | `emitir_convite`, `finalizar_cadastro`, `revisar_cadastro` e limitador: `anon=false`, `authenticated=false`, `service_role=true` |
| Segurança do QA | ✅ Advisor limpo | `get_advisors(type=security)`: `lints=[]` |
| Função real de teste | ✅ Implantada | Supabase `kids-auth`: ACTIVE, versão 1, `verify_jwt=false`; função verifica a origem e autenticação de cada ação |
| Banco inicialmente vazio | ✅ Confirmado | `auth.users=0`, `perfis=0`, `convites=0`, `auditoria=0` |
| Testes de sintaxe e unitários | ✅ Aprovados | GitHub Actions `43069347613`: 57 testes, 0 falhas |
| Workflow E2E QA | ⚠️ Bloqueado no preflight | Sem credenciais privadas em Secrets GitHub; aborta antes de alterar banco |
| Cadastro real, recusa, aprovação, JWT, concorrência | NÃO VERIFICADO | Workflow ainda não recebeu Secrets QA |
| Playwright Android/iPhone, 429, limpeza final | NÃO VERIFICADO | Exigem execução completa do workflow QA |

## 3. NÃO VERIFICADO

Os testes E2E com autenticação real, QR longo/código curto, aprovação/rejeição, RLS pendente e recusado, concorrência, navegador Playwright, rate limit e limpeza após cadastros permanecem pendentes. O servidor e schema QA foram instalados, mas **não existe prova de cadastro real concluído**.

## 4. Riscos

- A primeira execução E2E pode revelar erros de runtime, deployment CLI ou regras de cadastro que não apareceram nos testes unitários.
- Tokens de automação devem ter escopo mínimo no projeto QA. `sb_secret_` fica apenas nos Secrets GitHub, nunca no frontend.
- As correções estão na branch QA, ainda não testadas nem publicadas em produção.
- O motor WebKit em Linux não substitui iPhone físico.

## 5. Ação humana mínima (três Secrets)

Abrir https://github.com/gabriellve800-star/Escala-Kids-/settings/secrets/actions e salvar:
1. `QA_SUPABASE_ACCESS_TOKEN`: token pessoal para CI gerado em https://supabase.com/dashboard/account/tokens;
2. `QA_SUPABASE_DB_PASSWORD`: senha do banco Teste escala;
3. `QA_SUPABASE_SECRET_KEY`: chave `sb_secret_...` do projeto **Teste escala** (Project Settings → API Keys).

Não enviar nenhum valor no chat. ID e chave publicável do QA já foram conectados pelo assistente.

## 6. Estado

**⚠️ NÃO PRONTO** — migrations e função QA implantadas e verificadas, mas testes críticos ainda não executados. Produção continua v1.2.2 / `kids-auth` v5.

Links:
- [Workflow E2E](https://github.com/gabriellve800-star/Escala-Kids-/actions/workflows/qa-supabase-e2e.yml)
- [Manual dos 3 Secrets](https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/testes/CONFIGURAR_SUPABASE_QA.md)
- [Branch QA](https://github.com/gabriellve800-star/Escala-Kids-/tree/qa/convites-20261111)
