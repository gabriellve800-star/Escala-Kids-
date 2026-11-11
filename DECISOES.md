# Decisões técnicas — Escala Kids

- 11/11/2026: PRONTO só com testes reais ponta a ponta, segurança e limpeza comprovada.
- 11/11/2026: Este ramo de QA mantém o código fiel à função em produção v5 para reproduzir antes de corrigir.
- 11/11/2026: O teste real de criação de conta sintética por HTTP foi bloqueado pela ferramenta; não contornar a proteção.
- 11/11/2026: O limitador por IP compartilhado falha na 21ª tentativa/hora; causa demonstrada em SQL transacional.
- 11/11/2026: A função ignora o resultado de deleteUser durante o rollback; risco de conta órfã, teste vermelho.
- 11/11/2026: QA em branch separada, sem publicar correções não comprovadas em produção.


## 11/11/2026 — Homologação isolada

- Todas as credenciais do QA ficam apenas em **GitHub Actions Secrets**, nunca em arquivos ou mensagens.
- O workflow QA recusa explicitamente as referências de produção Escala Kids e Farmacheck.
- Migrations do projeto QA são reprodutíveis e baseadas em consultas da produção; não aplicadas à produção.
- Função `kids-auth` do ramo QA usa `QA_TEST_ORIGIN` somente para testes de navegador local, além da origem pública.
- Contas e senhas sintéticas criadas dentro do runner; limpeza obrigatória em `if: always()`, com conferência de zero resíduos.
- A versão ao público permanece **v1.2.2 / backend v5** até conclusão de 100% dos testes reais e segunda checagem da publicação.
- Playwright WebKit é emulação de Safari/iPhone, não prova em iPhone físico.
- A fonte de evidência é o ID do GitHub Actions e a saída resumida, sem tokens, senhas, e-mails ou códigos de convite.


## 11/11/2026 — QA aprovado, produção bloqueada por smoke público

- Prova de homologação **run 43081560210** (commit `42a940dfeb06f44d5b0fc24a22a0f61f147b99fd`): **61/61** unitário + HTTP; **12/12** Playwright Android/Chrome e iPhone/WebKit; **10/10** cadastros UI persistidos e auditados; RLS pendente/recusado com JWT real; concorrência; 25 pessoas/validações na mesma rede sem bloqueio; 429 por código; ZERO resíduos.
- **Causa e regressão:** validação antiga aceitava e-mail `ana@🙂.com`, local >64 e `..`; tests `testes/validacoes.test.cjs` e HTTP negativos.
- **Causa e regressão:** rollback ignorava retorno de `deleteUser`; branch QA exige `error` nulo e nova leitura `getUserById`; testes de nome duplicado/concorrência e zero órfãos.
- **Causa e regressão:** limite genérico por IP bloqueava pessoas na mesma rede na 21ª tentativa; migration QA parametriza por IP e por código/usuário, com testes reais de 25 validações e 429 no limite por código.
- **Causa e regressão CI:** Supabase CLI exige `--yes` para deploy não interativo; o workflow agora passa `--yes`; deploy comprovado.
- **Causa e regressão CI:** `DELETE` sem `WHERE` era rejeitado pelo Postgres remoto, código `21000`; migration QA agora restringe `chave is not null`; `test:qa:cleanup` e consulta independente 0.
- **Causa e regressão CI:** Playwright 1.56.1 não suportava runner padrão Ubuntu 26.04; runner fixado em `ubuntu-24.04`; navegador testado.
- **Causa e regressão CI:** `browserName` dentro de `describe` impede worker e simulação; configuração moved para projetos Playwright; 12 testes passaram sem skips.
- **Causa e regressão CI:** Chrome poderia perder o QR ao atualizar `history.replaceState` e recarregar sequencialmente; `addInitScript` injeta a query antes de iniciar o app, comprovado em Chrome e WebKit.
- **Decisão de release:** GitHub `main` / Supabase produção **não alterados**; não promover até smoke ponta a ponta e limpeza no ambiente publicado.
