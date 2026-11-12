# Escala Kids · Fase 3 · PR 1 — base segura (revisão do proprietário)

**Status:** candidato à revisão; não mesclar na main, não aplicar em produção.
**Ambiente de execução autorizado:** Supabase **Teste escala**, `eofoeijyfpptcktiqeah`.
**Produção proibida:** Supabase **Escala Kids**, `pntzfuxwkjreugxzovjj`.
**Base de código:** v1.2.5, sem modificações em HTML/JS/CSS, login, convites ou Edge Function.

## Decisões já incorporadas

1. Quatro turmas identificadas pela **posição 1 a 4**, sem nomes/faixas presumidos. Nome e limites em meses são editáveis, com auditoria.
2. Admin conserva leitura integral da base ministerial via RLS onde apropriado; **saúde somente via futuro backend auditado**, inclusive para admin.
3. Delegação granular por administrador, no cadastro do voluntário (interface ainda será implementada no **PR 2**). A delegação não concede automaticamente visibilidade de outras turmas ou dados de saúde.

| Permissão para equipe | Efeito | Limite |
|---|---|---|
| `gerenciar_turmas` | Criar/editar uma das quatro turmas | Não consulta crianças por si só |
| `cadastrar_criancas` | Autorização futura no backend de cadastro | Sem gravação direta via cliente |
| `confirmar_cadastros` | Autorizar revisão específica no backend | Sem leitura geral de todas as crianças |
| `gerenciar_vinculos` | Gestão futura sob verificação/auditoria | Não concede acesso a contatos a voluntários |
| `gerenciar_presencas` | Operação futura de presença | Escala do dia obrigatória no backend |
| `chamar_responsavel` | Operação futura de chamado | Escala + presença obrigatórias |
| `consultar_saude` | Pré-requisito opcional para backend clínico | Não abre `SELECT` em saúde; escopo por turma e auditoria |

## Tabelas e barreiras

- `public.familias_kids`: Auth separado de `perfis`, verificação de contato, aprovação.
- `public.permissoes_equipe_kids`: edição somente administrador; leitura própria pela equipe.
- `public.turmas_kids`: quatro posições, nomes e faixas em meses configuráveis.
- `public.escalas_turmas_kids`: vincula escala existente a UUID da turma. **A ausência de vínculo nega acesso**; nunca inferir permissão por nome em texto.
- `public.criancas_kids`: UUID, `ANAD` server-side e imutável, nome, nascimento, turma, status.
- `public.vinculos_kids`, `public.consentimentos_kids`: vínculo confirmado e versão do consentimento.
- `public.presencas_kids`, `public.chamados_kids`: estruturas inertes até PRs 2 e 3.
- `public.coberturas_kids`: exceção somente por admin/líder, com vencimento máximo em 24 horas e auditoria.
- `public.dispositivos_familia_kids`, `public.solicitacoes_privacidade_kids`: leitura pelo próprio titular e operação via futuro servidor.
- `private.saude_kids`, `private.assinaturas_push_kids`, `private.convites_familia_kids`, `private.retencao_kids`: **zero grants para clientes + RLS explicitamente negando tudo**. Backend deverá checar autorização e registrar auditoria antes de acessar informações sensíveis.

**Sem fotos, sem envio de dados pessoais no Push ou URL.** Termo legal ainda não disponibilizado; não começar piloto.

## Regras de acesso

- Responsável só consulta seus vínculos confirmados; responsável A nunca acessa criança B.
- Professor/auxiliar só vê fichas de turma **com escala no dia local `America/Sao_Paulo`** e mapeamento válido para ID; portaria não tem SELECT geral.
- Admin/líder veem as crianças; nenhum papel acessa a tabela de saúde diretamente via cliente.
- Dados antigos de equipe continuam com as policies anteriores, mas os helpers `private.ativo/admin_ativo/lider_ativo/pode_aprovar` foram endurecidos para rejeitar identidades familiares.
- Triggers de identidade impedem a mesma conta Auth de se registrar simultaneamente como equipe e responsável.
- Ações com potencial de conceder acesso (permissões, vínculo de escala e cobertura) possuem auditoria.
- Tabelas de crianças e chamados **não têm permissão de INSERT/UPDATE/DELETE para `authenticated`** nesta etapa: operações serão feitas em Edge Functions/SQL transacionais futuras, com controles adicionais.

## Testes executados no projeto de homologação

- Migrações aplicadas somente em `Teste escala`.
- SQL com identidades fictícias e `ROLLBACK`: isolação família A/B; família sem acesso a tabelas ministeriais; professor fora de escala; voluntário comum; admin acessa crianças; admin delega edição de turmas sem abrir crianças; negação de saúde e de acesso anônimo; ANAD imutável; proibição de identidade dupla.
- SQL gravado em `supabase/tests/fase3_kids_rls_rollback.sql`. Scripts de contrato JS em `testes/fase3-seguranca.test.cjs`.
- **Nenhuma criança real e nenhum registro fictício persistido.** A sequência interna do ambiente de teste pode avançar durante testes revertidos; isso não recicla nem altera códigos reais.

## Fora do PR 1 — não afirmar como entregue

- Interface para administrar turmas/permissões em `Pessoas`: **PR 2**.
- Cadastro familiar e infantil, verificação de telefone/e-mail, consentimento, presença e direitos LGPD efetivos: **PR 2** com backend transacional; necessidade de termo do proprietário.
- Envio/visto/tempo real, Web Push, anti-spam, janela de desfazer e auditoria clínica: **PR 3**. Não há endpoint novo em produção.
- **Decisões 8 e 9**: escalonamento/telão e retirada segura continuam pendentes de confirmação específica. A presença (item 4) tem somente estrutura, sem ativação.
- Testes positivos com professor escalado no culto real e no celular, incluindo PWA/iOS/Push, ainda precisam de homologação. Nada foi cadastrado no app real.
- Não executar migração na produção antes de nova aprovação e revisão do plano de rollback. A futura aplicação deve seguir a ordem cronológica das migrations e incluir backup, RLS negativo e verificação de login/agenda.

## Arquivos da PR 1

- `supabase/migrations/20261112170000_fase3_kids_base_rls.sql`
- `supabase/migrations/20261112171000_fase3_fk_indices_private_deny.sql`
- `supabase/migrations/20261112172000_fase3_separar_identidades.sql`
- `supabase/migrations/20261112173000_fase3_auditoria_acessos_turma.sql`
- `supabase/tests/fase3_kids_rls_rollback.sql`
- `testes/fase3-seguranca.test.cjs`
- `docs/fase3-pr1-contrato.md`

**Proteção de rollback:** em homologação, reverter com migration compensatória revisada, removendo primeiro os triggers e restaurando definições anteriores dos helpers, depois as tabelas novas em ordem reversa. Nunca descartar dados reais em produção.