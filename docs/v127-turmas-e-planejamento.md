# Escala Kids · v1.2.7 — Turmas permanentes e escala sugerida

**Status:** PR #6 em homologação, aguardando aprovação do proprietário. Sem merge, sem migrações em produção.  
**Produção:** `pntzfuxwkjreugxzovjj` — permanece na v1.2.6.  
**Teste escala:** `eofoeijyfpptcktiqeah` — duas migrations executadas por SQL direto, ainda sem reconciliação no histórico.

## Interpretação das regras

A estrutura é **fixa**: exatamente quatro turmas com UUID permanente. O nome e as idades em meses são configuráveis. Renomear uma turma não altera seu ID, as fichas ou os vínculos das crianças. As escalas anteriormente vinculadas ao ID recebem a nova etiqueta de exibição. Administrador e líder podem gerenciar as turmas; o administrador também pode delegar `gerenciar_turmas`.

As **pessoas variam a cada culto** e são alocadas de acordo com a disponibilidade enviada para o mês seguinte e com as funções ministeriais que a equipe cadastrou em `funcoes_pessoa`.

Necessidade inicial assumida para o algoritmo: **um professor e um auxiliar por turma, mais uma pessoa na portaria e uma na cozinha** por culto. Isso equivale a dez vagas por culto. Essa é uma hipótese operacional, não um dimensionamento definitivo. Se a liderança definir quantidades diferentes, a regra precisa ser tornada configurável em PR posterior.

## Fluxo de planejamento

1. O voluntário cadastra disponibilidade para o **mês seguinte** na agenda já existente.
2. Um administrador, líder ou usuário autorizado com `montar_escalas` abre **Escala sugerida** e escolhe **Gerar sugestão**.
3. O algoritmo combina função habilitada + disponibilidade do culto + escala já publicada, impedindo duas funções para a mesma pessoa no mesmo culto e buscando equilibrar designações ao longo do mês.
4. A planilha mostra dia, culto, turma/setor, função e pessoa sugerida. Vagas sem candidato são **Vaga aberta**; não inventar nome nem esconder déficit.
5. O gestor pode trocar o voluntário entre candidatos elegíveis, preencher o horário do culto e salvar o **rascunho compartilhado**.
6. Apenas líder, administrador ou quem recebeu `aprovar_escalas` pode **Aprovar e publicar**. A aplicação revalida as regras no servidor em uma única transação.
7. Quando uma vaga já tem escala publicada, aparece **Já publicado**. A sugestão não altera o registro existente silenciosamente. Uma sugestão aprovada não pode ser reaprovada.

## Permissões e segurança

| Operação | Autorização |
|---|---|
| Editar os quatro nomes e faixas | Administrador, líder, ou delegação `gerenciar_turmas` |
| Ler disponibilidades da equipe para montar | Administrador, líder, `montar_escalas` ou `aprovar_escalas` |
| Gerar e salvar rascunho | Mesmos papéis de planejamento |
| Aprovar e publicar sugestão | Administrador, líder ou `aprovar_escalas` |
| Família ou voluntário comum | Sem acesso ao planejador |

Operações privilegiadas residem em `private.*`, com wrappers `SECURITY INVOKER` na API pública. O rascunho fica em tabela privada com RLS deny-all e controle de versão. Os dados enviados e armazenados contêm exclusivamente IDs de equipe/turma, datas, cultos, funções e horários. **Não há ficha, diagnóstico, telefone, e-mail, número ANAD ou conteúdo clínico no planejador.**

Professor/auxiliar recebem vínculo UUID na publicação da escala; **portaria e cozinha não recebem vínculo de turma**, evitando autorização infantil acidental. Para cargos de portaria/cozinha, a verificação de vaga publicada independe do texto legado da turma.

## Arquivos

- `planner.js`: algoritmo de sugestão e planilha responsiva, com funções puras testáveis.
- `app.js`: tela e navegação do planejador, ajustes manuais, salvamento/aprovação, permissões de equipe.
- `kids-ui.js`: edição de nome/faixa visível para líder/ADM/autorizado.
- `agenda.js`: acesso do líder à nova tela de sugestão.
- `styles.css`, `index.html`, `sw.js`, `package.json`, `package-lock.json`: UI e versão PWA **1.2.7**.
- `supabase/migrations/20261113171500_v127_turmas_fixadas_permissoes.sql`: edição segura e delegações.
- `supabase/migrations/20261113172500_v127_planejador_rascunho_aprovacao.sql`: base segura, rascunhos e publicação atômica.
- `supabase/tests/v127_planejamento_rollback.sql`: execução SQL com usuários/escala 100% fictícios e ROLLBACK.
- `testes/v127-planner.test.cjs`: teste determinístico de sugestões, vagas, conflitos e interface.
- Ajustes apenas de contratos de versão nos testes antigos.

## Evidências da homologação

- SQL em Teste escala retornou `QA_V127_PLANEJAMENTO_RLS_ATOMICO_OK`.
- Simulados: 4 turmas artificiais, 10 voluntários elegíveis por culto, administrador, líder e voluntário delegado (dados revertidos).
- Testes negativos: sem papel não lê planejamento; `montar_escalas` não concede `aprovar_escalas`; versionamento desatualizado rejeitado; dupla aprovação rejeitada; horários/pessoas revalidados no servidor.
- Renomeação feita por líder após publicação preservou vínculos e sincronizou a etiqueta das escalas.
- Supabase Security Advisor em Teste escala: **nenhum alerta de segurança ativo**.
- A última execução de CI do GitHub deve ser consultada no PR antes de aprovar, abrangendo regressão de login, convites, família e PWA.

## Não testado / limites e próximos cuidados

- Não houve teste autenticado da UI completa em aparelho Android ou iPhone; Lighthouse cobre a tela pública de login.
- Não há verificação de cobertura real do ministério, conflitos de presença durante o culto, alertas Push nem retirada de crianças.
- Não definimos horários reais dos cultos: a liderança deve preenchê-los antes da aprovação.
- Sugestões são para o próximo mês e a configuração inicial exige **as quatro turmas nomeadas e ativas**.
- O algoritmo usa disponibilidade e habilitação funcional, não critérios não documentados de qualificação pedagógica ou limites máximos de trabalho.
- Não houve mudança em dados de crianças ou saúde. O termo de consentimento da Fase 3 continua pendente.
- Em Teste escala as migrations foram aplicadas diretamente para revisão; sincronizar histórico por procedimento oficial antes de futuros `db push`. **Jamais reaplicar à força ou confundir QA com produção.**

**Gate de publicação:** o proprietário deve revisar o PR #6 e aprovar explicitamente a implantação. A versão v1.2.6 atual em produção não foi alterada.
