# ⚠️ NÃO PRONTO — Auditoria de convites Escala Kids (11/11/2026)

## 1. Resumo em 3 linhas

A versão pública continua sendo **PWA v1.2.2 / Edge Function v5**: não houve publicação de mudanças comportamentais em produção nesta auditoria.
Criei a ramificação `qa/convites-20261111` com testes automatizados, log sanitizado com ID de correlação e propostas para rollback, validação de e-mail e limite por IP compartilhado.
**Falta prova do cadastro HTTP real com conta sintética, aprovação, recusa, segurança com token real e limpeza após fluxo completo; portanto a versão NÃO está homologada.**

## 2. Evidências e resultados

| Teste | Resultado | Evidência |
|---|---|---|
| Estado real antes de mexer | CONFIRMADO | GitHub Pages `main` commit `c3e866b58d8`, workflow SUCCESS; `kids-auth` v5 ACTIVE, `verify_jwt=false`. |
| Últimos registros da função | CONFIRMADO | Eventos `GET/405`, `POST/400`, `POST/403` em 11/11 às 16:38 UTC; na janela consultada: 23 POST/400, nenhum POST/201 e nenhum POST/422. Logs não revelam o campo que causou os 400 anteriores. |
| Convite sintético — `check_invite` HTTP real | PASSOU (código curto) | HTTP 200, `{ok:true,valid:true}` contra `kids-auth`, convite descartável retirado do banco após a checagem. **QR longo NÃO VERIFICADO** nesse teste. |
| Primeiro teste automatizado (estado anterior, fase RED) | FALHOU como esperado | GitHub Actions run `43059399550`: 52 testes, 50 passaram, **2 falharam** (rollback `deleteUser` sem checagem e log SQL livre). |
| Novas bordas de e-mail, fase RED | FALHOU como esperado | GitHub Actions run `43061118807`: validação aceitava domínio com emoji/local >64/pontos duplos. |
| Bateria automática após correção proposta | PASSOU no ramo QA | Execução `43061251701`: 59/59 testes, incluindo 4 chamadas HTTP negativas ao backend real; um commit seguinte adicionou testes para ID de correlação e foco do campo. |
| Limite IP atual (fase RED) | FALHA REPRODUZIDA | `limitar_cadastro` liberou tentativas 1–20 e rejeitou a 21ª para a mesma chave dentro de uma transação revertida. |
| Limite de IP proposto | PASSOU em SQL isolado | Função de dois argumentos criada somente durante transação, 60 tentativas permitidas, 61ª rejeitada; segunda chave permitida; `ROLLBACK` confirmou teste sem instalação da alteração. |
| Permissões RLS e grants | INSPEÇÃO CONFIRMADA | 4 políticas RLS; funções públicas privilegiadas executáveis por `service_role`, sem `EXECUTE` por `anon` ou `authenticated`; veja `auditoria/snapshot_permissoes_v122.md`. Isso não substitui teste usando token real de pendente. |
| Limpeza de resíduos | PASSOU para os artefatos usados | 0 `auth.users` sintéticos, 0 perfis QA, 0 auditorias QA, 0 tabelas QA, 0 extensões HTTP temporárias; base ficou com 1 conta real e 4 convites pré-existentes (0 consumidos). |

## 3. NÃO VERIFICADO — bloqueios críticos

- **CRÍTICO:** `register` HTTP com senha sintética, confirmação `auth.users +1`, perfil `pendente`, uso +1, auditoria +1. A ferramenta bloqueou a operação de criação HTTP; não contornei essa restrição.
- **CRÍTICO:** aprovação e recusa via função HTTP com token de administrador sintético; entrada do usuário aprovado, isolamento de acesso com tokens reais de `pendente` e `recusado`.
- **CRÍTICO:** duas inscrições simultâneas em convite de um uso; limpeza comprovada de eventuais contas órfãs após esse cenário.
- **CRÍTICO:** teste do limite 429 no HTTP real em cenário de rede compartilhada e validação do ajuste **depois** de implantar SQL e backend em QA.
- Interface Playwright Android e iPhone: navegador da infraestrutura bloqueou até página local (ERR_BLOCKED_BY_ADMINISTRATOR); WebKit/iOS real indisponível. Formulário offline e cache antigo não verificados.
- A proposta do ramo QA **não foi implantada em produção**; portanto não existem hash HTTP publicado, atualização de cache ou fluxo B pós-deploy que a homologuem.
- Check-in e escala completa: não implementados como funções reais na fase atual, portanto regressão ponta a ponta não aplicável.

## 4. Riscos remanescentes

Na produção v5, `deleteUser` pode falhar sem checagem, o log SQL pode conter detalhe livre, e o rate-limit de 20 tentativas/hora por IP pode bloquear pessoas na mesma rede. A validação de e-mail aceita casos que o Auth pode rejeitar. O Supabase mostrou o aviso de segurança **Leaked Password Protection Disabled**. Uma origem CORS autorizada não substitui autenticação/autorização do servidor.

A hipótese principal para o incidente do voluntário continua sendo validação local/nativa do navegador ou rejeição de campos antes da persistência. **Não foi possível confirmar qual campo causou a tentativa específica**.

## 5. O que o administrador precisa testar no celular

**Nada agora.** Enquanto os itens críticos anteriores estiverem pendentes, não solicitar teste com voluntário real nem liberar a equipe.

## 6. Estado

**⚠️ NÃO PRONTO**. Os testes de código e HTTP negativo executados passaram após correções em ramo de QA, mas **o fluxo real de ponta a ponta exigido ainda não está provado**. Não fazer merge nem deploy da proposta sem homologação.

### Fontes e rastreabilidade

- Ramo: https://github.com/gabriellve800-star/Escala-Kids-/tree/qa/convites-20261111
- Testes: `/testes` (comando `npm test`).
- Função original v5 e proposta de QA: `supabase/functions/kids-auth/index.ts`.
- SQL de limite por rede: `supabase/sql-propostas/limite_por_rede.sql` (**não aplicado**).
- Decisões: `DECISOES.md`; alterações: `CHANGELOG.md`.
- Snapshot: `auditoria/snapshot_permissoes_v122.md` contém **12 funções SQL, 4 RLS, grants, permissão de execução e triggers**.
