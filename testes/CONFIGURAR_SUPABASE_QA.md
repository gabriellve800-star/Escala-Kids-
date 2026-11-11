# Escala Kids — configurar o projeto Supabase de TESTE

Atenção: todas as ações de CI são no projeto recém-criado **Escala Kids QA**. Não copiar projetos de produção nem fornecer credenciais no chat.

## Criar

1. Supabase Dashboard → **New project** → nome `Escala Kids QA`; organização da igreja; escolher região e definir senha do banco.
2. Abrir o novo projeto → **Project Settings → API Keys**: copiar chave publicável `sb_publishable_...` e chave secreta `sb_secret_...`.
3. Copiar o ID do projeto `project ref` da URL `supabase.com/dashboard/project/<REF>` — apenas do projeto QA.
4. Abrir https://supabase.com/dashboard/account/tokens e gerar um **Personal Access Token** próprio para automação. Não enviar a ninguém.
5. Abrir https://github.com/gabriellve800-star/Escala-Kids-/settings/secrets/actions → **New repository secret**.

| Secret GitHub | Valor |
|---|---|
| `QA_SUPABASE_PROJECT_REF` | ID de 20 caracteres do projeto QA |
| `QA_SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase |
| `QA_SUPABASE_DB_PASSWORD` | Senha do banco do projeto QA |
| `QA_SUPABASE_PUBLISHABLE_KEY` | Chave **publicável** (sb_publishable_) do projeto QA |
| `QA_SUPABASE_SECRET_KEY` | Chave **secreta** (sb_secret_) do projeto QA |

## Executar

Depois de salvar os cinco Secrets, abrir:
https://github.com/gabriellve800-star/Escala-Kids-/actions/workflows/qa-supabase-e2e.yml

Selecionar **Run workflow**, branch `qa/convites-20261111`.

O workflow:
- verifica que o ID não corresponde aos dois projetos existentes;
- gera e versiona `package-lock.json` se necessário e instala dependências pinadas;
- aplica migrations exclusivamente no projeto QA;
- publica a função `kids-auth` QA e configura origin local exclusivo do QA;
- executa validações, fluxo HTTP com contas sintéticas e segurança com JWT real;
- faz 12 testes de UI (6 por Android Chromium e iPhone WebKit);
- confere no banco 10 cadastros visuais;
- testa limite por IP e 429;
- executa a limpeza mesmo quando algum passo falhar, e exige zero resíduos.

## Limites e riscos

- O runner emula Android/Chrome e o motor WebKit de Safari; **não é iPhone físico**.
- O token pessoal dá acesso à organização do Supabase; armazená-lo somente nos GitHub Secrets e rotacionar se vazar.
- Esta branch **não faz merge nem deploy na produção**.
- Não habilite GitHub Pages nesta branch; o navegador de testes usa `localhost`.
- O workflow é vermelho até configurar os Secrets; isto é intencional, não falha de produção.
- O relatório de aprovação só poderá ser emitido quando **todas** as etapas ficarem verdes, inclusive limpeza.
