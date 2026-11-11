# Escala Kids — publicação controlada e reversão v1.2.3

**DOCUMENTO PRÉ-DEPLOY. NÃO EXECUTAR AINDA.**
Produção Supabase: `pntzfuxwkjreugxzovjj`. QA: `eofoeijyfpptcktiqeah`.
GitHub Pages: https://gabriellve800-star.github.io/Escala-Kids-/
GitHub `main` antes do candidato: `c3e866b58d8b187e5adc3b30d455cb880d92a3b9`.
Backend produção: `kids-auth` **v5** (fonte preservada em `auditoria/rollback/kids-auth-v5-index.ts`, hash de bundle `5767953f521acfd3d84d1c8808ff89c29048f2640f3e7c69b9f165f87d020f59`).

## Pré-requisitos (regras de liberação)

1. Relatório de paridade DB/RLS/grants/triggers atualizado, sem diferenças não intencionais.
2. Última execução E2E da **versão candidata exata** concluída como success: unitários, Auth real, concorrência, JWT, Android+WebKit, limites 429, cleanup ZERO.
3. Aprovação explícita do administrador **depois de receber o relatório pré-deploy**.
4. Backup versionado do código da função v5 e commit do site antigo; confirmação de acesso privilegiado ao Supabase de produção para reversão imediata.
5. Definição de janela de mudança em que não há cadastro real em andamento.

## Sequência de rollout, apenas após aprovação

A. **Migrations estritamente aditivas.** Adicionar à produção SOMENTE a função `public.limitar_cadastro(p_chave text,p_max integer)` do arquivo `supabase/sql-propostas/limite_por_rede.sql` (sem alterações à função de um argumento). Aplicar a GRANT `EXECUTE ... TO service_role` e revogar de anon/authenticated. **Nunca aplicar migrations QA de bootstrap, rebuild da tabela convites ou `qa_limpar_limites` em produção.** Testar 2 assinaturas, grants e ausência de mudança nos registros reais.

B. **Implantar nova Edge Function.** Implantar `supabase/functions/kids-auth/index.ts` + dependência `auth-errors.mjs` no projeto de produção. A origem QA localhost só é habilitada quando `SUPABASE_URL` é a referência do QA; confirmar que localhost não é autorizado na produção. Registrar SHA da fonte, nova versão ativa e resposta a testes negativos sem criar contas reais.

C. **Publicar frontend de maneira seletiva** na branch `main`: `app.js`, `index.html` e `sw.js` do release candidate 1.2.3. Manter `config.js` apontando para **produção**, sem chave secreta, e os demais arquivos preservados. Não fazer merge da branch QA inteira nem copiar configurações de teste e migrations do QA. Verificar conclusão com sucesso do workflow do GitHub Pages.

D. **Conferência real do endereço público.** Requisitar HTTP de `index.html`, `app.js?v=1.2.3`, `sw.js` e `config.js` sem cache: comparar conteúdo/hash ao commit do release; confirmar `v1.2.3` em HTML e no app, `CACHE` atualizado em sw.js, service worker instalado/ativado e cache antigo removido após confirmação de atualização. Caso contrário, **não liberar**.

E. **Smoke em produção com dados sintéticos isolados** (credenciais de produção mantidas em ambiente seguro, nunca no chat; NÃO reutilizar secrets do QA). Gerar admin descartável com identificador prefixado e convite próprio. Abrir o endereço público em navegadores automatizados, registrar via QR e código curto, conferir no Auth + perfil pendente + auditoria + usos, aprovar/recusar e validar RLS com JWT real. Limpar EXCLUSIVAMENTE IDs e convites criados pelo teste, sem tocar em registros de voluntários. NÃO executar `qa_limpar_limites` nem deletar toda tabela na produção. Consultar zero resíduos identificados pelo prefixo. Fazer backup de logs sanitizados, hashes e id do GitHub Actions.

F. **Liberação.** Somente depois do smoke público, limpeza e versões confirmadas, declarar PRONTO. Caso algum item falhe, iniciar rollback imediatamente, sem cadastrar voluntários reais para depuração.

## Plano de rollback operacional (meta: poucos minutos, depende dos serviços)

**R1 — Backend (prioridade).** Com autorização da conta Supabase de produção, redeploy da fonte *preservada* da função v5:
- Abrir a cópia do repositório de release e substituir temporariamente `supabase/functions/kids-auth/index.ts` pela fonte do arquivo `auditoria/rollback/kids-auth-v5-index.ts`.
- Executar pelo CLI autenticado **com token de produção em cofre**, NUNCA no chat:
  `supabase functions deploy kids-auth --project-ref pntzfuxwkjreugxzovjj --no-verify-jwt --yes`.
- Ou usar a ferramenta Supabase conectada para publicar exatamente a mesma fonte (sem repassar credenciais).
- **A versão numérica após redeploy aumenta**: não exigir que o painel volte a exibir 'v5'; comparar conteúdo com a fonte v5 salva e executar smoke mínimo de login + validação de convite.
- Manter a função antiga `limitar_cadastro(p_chave text)` intacta; não remover a nova sobrecarga imediatamente (DDL aditivo não exige rollback destrutivo).

**R2 — Site GitHub Pages.** Restaurar somente arquivos publicados (sem reverter registros do banco) a partir do commit congelado:
```bash
git fetch origin main
git switch main
git pull --ff-only origin main
git restore --source=c3e866b58d8b187e5adc3b30d455cb880d92a3b9 --staged --worktree -- app.js index.html sw.js config.js
git commit -m "revert: Escala Kids web v1.2.2 stable"
git push origin main
```
Usar GitHub Work/Actions com permissão de escrita ou operador autorizado, conforme o controle de acesso. Monitorar o job de GitHub Pages e verificar, por HTTP sem cache, versão **v1.2.2**, asset `app.js?v=1.2.2` e cache SW anterior.

**R3 — Verificação pós-rollback.** Confirmar serviço login, convites e painel; testar RLS/autorizações e que não existem resíduos sintéticos. Registrar URL e SHA do workflow Pages, versão da função (conteúdo v5), timestamp e motivos. A reversão não é garantida dentro de minutos se GitHub/Supabase estiverem indisponíveis; não prometer tempo fixo.

## Não verificado nesta fase

- Mudanças de produção **não aplicadas**.
- Smoke contra URL pública **não executado**.
- Reversão simultânea de backend/Pages em ambiente de produção **não executada**; há backup e procedimentos prontos.
- Não solicitar teste com aparelho real até os itens anteriores passarem.
