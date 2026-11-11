# Escala Kids — Fase 1

## Publicação no GitHub Pages

Este pacote contém apenas os arquivos públicos do aplicativo, em uma só pasta (sem subpastas), para facilitar o envio pelo celular.

1. **Descompacte** o ZIP em seu celular. Não envie o ZIP ao GitHub.
2. Abra https://github.com/gabriellve800-star/Escala-Kids-
3. Na página do repositório vazio, toque em **uploading an existing file**. Se já houver arquivos, use **Add file → Upload files**.
4. Selecione **todos os 9 arquivos** desta pasta, inclusive `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.webmanifest` e ícones.
5. Confirme em **Commit changes**.
6. Entre em **Settings → Pages** e escolha **Deploy from a branch → main → /(root) → Save**.
7. O endereço esperado será https://gabriellve800-star.github.io/Escala-Kids-/ depois da publicação.

## Atenção

- O GitHub Pages hospeda apenas a interface pública; os dados e os logins devem ser validados pelo Supabase.
- A função `kids-auth` do servidor já foi publicada no Supabase. Ainda falta testar o login, convites, permissões e troca de senha no aplicativo hospedado.
- Não inclua chave `service_role`, senhas nem dados de crianças no repositório.
- Não use informações reais de menores antes das fases de segurança e testes de acesso.
- Cada atualização deve alterar a versão `CACHE` em `sw.js` para exibir a opção de atualização no aplicativo.
