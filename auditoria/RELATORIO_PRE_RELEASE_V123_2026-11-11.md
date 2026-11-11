# ⚠️ NÃO PRONTO PARA PUBLICAÇÃO — Relatório pré-deploy Escala Kids v1.2.3
**Data:** 11/11/2026 · **QA homologado:** [GitHub Actions #43085716043](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43085716043) · **SHA testado:** `86462ecdfd2bab929d279d17e982144265614185`.

## 1. Resumo em três linhas

Produção e QA têm estrutura idêntica em tabelas, **31 colunas com a mesma ordem**, constraints, índices, RLS, grants e triggers; as únicas diferenças SQL restantes são **duas funções adicionais intencionais no QA**.
O novo candidato v1.2.3 passou **72/72 testes de código e HTTP**, **12/12 testes Playwright**, **10/10 cadastros de navegador verificados no banco**, concorrência, segurança real por JWT, rate limit e limpeza com **ZERO resíduos**.
**Nenhum defeito corrigido foi demonstrado como causa específica do HTTP 400 do voluntário.** Produção continua v1.2.2 / Edge `kids-auth` v5, sem publicação.

## 2. Testes e evidências

| Teste / categoria | Resultado | Evidência |
|---|---|---|
| Tabelas de aplicação | ✅ Paridade exata, **5/5** | Consulta `pg_class` `public` + `private` |
| Colunas (nome, tipo, nulos, default, posição) | ✅ Paridade exata, **31/31** | Consulta `information_schema.columns`; reconstrução QA de `convites` via migration `20261111190513` |
| Constraints e índices | ✅ **24/24**, **16/16** | `pg_constraint`, `pg_get_indexdef` |
| Políticas RLS | ✅ **4/4** | `pg_policies`; textos idênticos |
| Grants de tabelas | ✅ **32/32** | `information_schema.role_table_grants`; idênticos |
| Funções SQL | ✅ **12/12 compartilhadas idênticas** | `pg_get_functiondef`; QA tem ainda `limitar_cadastro(p_chave,p_max)` e `qa_limpar_limites()` para homologação, ausentes corretamente em produção |
| Grants de execução de funções | ✅ **36 compartilhados idênticos** | QA tem seis verificações extras (três papéis × duas funções extras); nenhuma alteração nos existentes |
| Triggers de aplicação e em `auth.users` | ✅ **0/0** | `pg_trigger`, não internos |
| Backend Edge | ⚠️ Diferença **intencional** | Produção v5, hash `5767953f...`; QA v4, hash `ab26e7d4...`. Fonte candidata inclui validação, logger e mapper de erro corrigidos |
| RED/GREEN e-mail de `v1.2.2` | ✅ REPRODUZIDO | Testes `regressoes-v122-auth.test.cjs` comprovam que o validador anterior aceitava `ana@🙂.com`, 65 caracteres antes do `@` e pontos duplos; v1.2.3 rejeita |
| HTTP 400 específico do voluntário | ⚠️ **NÃO REPRODUZIDO** por correção identificada | No código v5, convite inválido/expirado/usado e JSON incorreto podem retornar 400; nova função ainda retorna 400 corretamente para esses casos. Não há código de correlação da tentativa para atribuir causa |
| Mapeamento `createUser email_exists` | ✅ Teste unitário + integração real | Mapper retorna 409/`field=email` e mensagem de e-mail já cadastrado; integração com e-mail duplicado real passou e não criou conta órfã |
| `createUser weak_password/password_too_short` | ✅ Teste unitário isolado | Mapper real importado pela Edge retorna 422/`field=senha`, sem mencionar e-mail; sem forçar essa falha na configuração Auth do servidor |
| `createUser` inesperado / 429 / e-mail inválido | ✅ Teste unitário isolado | Falha inesperada 503 sem `field=email`; 429 sem culpar e-mail; endereço inválido 422/`email` sem chamar duplicado |
| HTTP real: convite, registro, aprovação, recusa e login | ✅ PASSOU | `QA PASS: register real Auth+1, perfil pendente, convite+1, auditoria+1`; `review` e `login` |
| JWT real pendente/recusado e concorrência | ✅ PASSOU | Leituras/alterações negadas; único uso gera 1 sucesso, zero órfãos |
| Unitários e HTTP | ✅ **72/72** | Logs GitHub `# tests 72 # pass 72 # fail 0 # skipped 0` |
| Playwright Android Chrome + iPhone WebKit | ✅ **12/12** | Logs `12 passed`: QR longo, código curto, senha, toque duplo, offline e cache |
| Cadastro via browser persiste e aparece na auditoria | ✅ **10/10** | Conferidos `auth.users`, `perfis`, `convites` e `auditoria` |
| Rate limit rede compartilhada / 429 | ✅ PASSOU | 25 validações seguidas permitidas, limite por código devolveu 429 |
| Limpeza após testes | ✅ **ZERO resíduos** | Auth, perfis, convites, funções, auditoria e limites = 0; confirmação independente após workflow |
| Versão/caches candidatos | ✅ Testado em QA | HTML, app e SW coerentes em **v1.2.3**; testes de cache passaram |
| Produção ainda intacta | ✅ CONFIRMADO | `main` = `c3e866b58d8b187e5adc3b30d455cb880d92a3b9`, backend produção **v5** |

## 3. NÃO VERIFICADO (e causa)

- **Causa exata do HTTP 400 relatado pelo voluntário:** registros de produção não têm campos/código de correlação suficientes para distinguir caso de convite inválido, formulário ou outra rejeição. **Nenhuma correção demonstrada reproduziu especificamente o incidente.** A nova função adiciona `request_id` e etapa para ocorrências futuras.
- **Falhas de Auth fraca e inesperada provocadas pelo serviço real:** o mapper foi exercitado de forma determinística por código de erro, mas o ambiente QA não forçou uma nova configuração de senha no Supabase; cobertura live comprovada para email duplicado.
- **CRÍTICO:** publicação na produção, workflow Pages concluído, hashes dos arquivos públicos, cache do SW na URL pública e E2E sintético **após** o deploy. Não foi feita publicação nesta etapa.
- Reversão em ambiente de produção: fonte original de backend e SHA do site estão preservados; implantação da reversão real não foi disparada.
- Android e iPhone físicos (Playwright foi emulação); não solicitar testes humanos até fechamento do smoke público.

## 4. Riscos remanescentes

- Nova função em produção usa `limitar_cadastro(p_chave,p_max)`; antes da Edge precisa de migration **aditiva exclusiva para a produção**, que preserve `limitar_cadastro(p_chave)` antiga para rollback.
- Configurações globais do Supabase Auth podem diferir entre projetos embora tabelas/RLS/grants estejam iguais; não foi feita comparação completa dessas configurações.
- A causa do HTTP 400 original continua não identificada; o rollback verificado permite resposta a falhas pós-deploy, mas não substitui monitoramento.
- O deploy e a reversão dependem da disponibilidade de GitHub Pages/Supabase, sem garantia de tempo fixo.

## 5. Plano controlado de publicação, smoke e rollback

**Candidato seguro, sem merge:** [PR em rascunho #1](https://github.com/gabriellve800-star/Escala-Kids-/pull/1), branch `release/escala-kids-v1.2.3`. Parte do `main` estável e contém somente três arquivos de PWA, a Edge candidata e uma migration aditiva; não inclui `qa_limpar_limites`, migrations QA de bootstrap nem credenciais.

**Sequência sob aprovação:** 1) confirmar checkpoint `main` + salvar backend v5; 2) aplicar somente a nova sobrecarga de rate limit e os grants na produção; 3) publicar Edge candidata; 4) enviar 3 arquivos do frontend v1.2.3 ao `main`, verificar deploy Pages, versão e hashes; 5) executar no endereço público o smoke E2E com dados sintéticos exclusivos, conferir pendência, aprovação/rejeição, JWT, auditoria, cache e **deletar somente IDs sintéticos**; 6) se falhar, reverter.

**Reverter backend:** redeploy da [fonte v5 preservada](https://github.com/gabriellve800-star/Escala-Kids-/blob/196a2cdfbcdf3255a1d81cf2b356352ea935758f/auditoria/rollback/kids-auth-v5-index.ts) com CLI Supabase ou conector, autenticado para produção; validar código da fonte antigo, não exigir número de versão v5 porque redeploy cria versão numérica nova. A função SQL antiga permanece disponível.

**Reverter site:** restaurar `app.js`, `index.html`, `sw.js`, `config.js` do commit `c3e866b58d8b187e5adc3b30d455cb880d92a3b9`, criar commit de reversão em `main`, confirmar GitHub Pages SUCCESS, checar v1.2.2 e cache antigo. Não executar rollback SQL destrutivo da migration aditiva.

[Plano técnico de release, smoke e rollback com comandos](https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/auditoria/PLANO_RELEASE_ROLLBACK_V123.md).

## 6. Estado

- **✅ PRÉ-PRODUÇÃO / QA APROVADO.** [Execução comprovada](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43085716043) com 72/72 e 12/12, 10 cadastros verificados e limpeza ZERO.
- **⚠️ NÃO PRONTO PARA USO PÚBLICO.** Falta publicação controlada autorizada e o smoke final no endereço público.
- **Roteiro de até 5 passos para celular real:** deliberadamente **não fornecido nesta etapa**, conforme exigência de disponibilizá-lo somente após aprovação do smoke em produção.
