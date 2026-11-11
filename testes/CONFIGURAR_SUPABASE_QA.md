# Escala Kids — projeto de TESTE confirmado: Teste escala

Projeto QA: `eofoeijyfpptcktiqeah` (us-east-1). Projeto de produção: `pntzfuxwkjreugxzovjj`. **Não confundir.**

## Já executado pelo assistente

- Supabase QA localizado e estado ACTIVE_HEALTHY confirmado.
- Migrations instaladas no QA: `20261111174456_qa_schema_escala_kids_v122` e `20261111174505_qa_limitador_rede_compartilhada`.
- Função `kids-auth` versão 1 ativa exclusivamente no QA.
- Regras RLS nas quatro tabelas públicas, concessões apenas ao papel service_role e auditoria de segurança sem alertas.
- O ID do QA e a chave publicável (que não é segredo) já estão embutidos no workflow QA. **Não é necessário adicioná-los como Secret.**

## Restam SOMENTE três GitHub Secrets privados

No GitHub: https://github.com/gabriellve800-star/Escala-Kids-/settings/secrets/actions
Toque em **New repository secret** e insira os três valores abaixo. **Nunca envie valores no chat.**

| Nome exato | De onde copiar |
|---|---|
| `QA_SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens — criar token pessoal de escopo restrito ao projeto Teste escala, com acesso de leitura às chaves e administração de Edge Functions/migrations conforme necessário pelo CLI |
| `QA_SUPABASE_DB_PASSWORD` | Senha de banco criada para Teste escala. Se perdeu: Dashboard do Teste escala → Database → Settings → Reset database password |
| `QA_SUPABASE_SECRET_KEY` | Projeto Teste escala → Project Settings → API Keys → seção Secret keys, mostrar/copiar a chave `sb_secret_...` |

O access token é um token de automação **escopado ao projeto QA**, nunca à produção. Se permissões mínimas faltarem, ajuste o escopo somente para as operações de deploy exigidas.

## Como rodar

O workflow inicia automaticamente em mudanças da branch QA; sem Secrets ele interrompe antes do banco. Após salvar os três:
https://github.com/gabriellve800-star/Escala-Kids-/actions/workflows/qa-supabase-e2e.yml

- Toque em **Run workflow**, selecione **qa/convites-20261111**, e toque em **Run workflow**.
- Confira os steps, inclusive **Limpeza obrigatória e consulta de resíduos ZERO**. Resultado verde precisa incluir esse step.
- **Nenhuma liberação à produção é automática.** Esta branch é isolada e protegida contra o REF de produção.

## Como o teste funciona

- Migrações são conferidas no banco QA, sem duplicar migrations já registradas;
- Função `kids-auth` implantada no QA;
- Senhas e usuários sintéticos gerados no runner; sem logs com credenciais;
- Cadastro pelo código e QR; aprovação e recusa; negativos e RLS com JWT real; Playwright Android/Chrome e iPhone/WebKit emulados; limite 429;
- Cleanup obrigatório em `if: always()` com consulta de zero resíduos.

**Importante:** não coloque a senha do banco no código, não copie a chave `sb_secret_` no chat, não use o projeto da igreja para testes. Só publicar produção após prova E2E completa e revalidação do que está online.
