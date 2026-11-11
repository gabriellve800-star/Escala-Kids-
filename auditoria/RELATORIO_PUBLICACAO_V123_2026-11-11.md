# ✅ PRONTO PARA USO — Escala Kids v1.2.3 (11/11/2026)

## 1. Resumo em três linhas

A publicação controlada seguiu **migration → função → site**, após prova de compatibilidade da v5 no QA.
O GitHub Pages publicou a v1.2.3, a função `kids-auth` está ativa como versão 6, e o fluxo público por QR, código, aprovação, recusa, login, RLS e cache passou no GitHub Actions.
A limpeza confirmou **zero identidades sintéticas restantes**, preservando as contagens iniciais de usuários reais.

## 2. Teste | resultado | evidência

| Teste | Resultado | Evidência |
|---|---|---|
| v5 antiga após migration nova em QA | ✅ PASSOU | [Actions 43088223989](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088223989) · cadastro, aprovação, login, JWT e cleanup |
| QA v1.2.3 e logs sanitizados | ✅ PASSOU | [Actions 43088738686](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088738686) · 75/75 testes + 12 navegadores; 38 eventos QA amostrados com `request_id,stage,field,code` e sem padrões de credenciais/dados digitados |
| Secret de produção em cofre GitHub | ✅ CONFIRMADO | [Preflight 43089540688](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43089540688), tentativa 3 `success`; nunca exibido |
| Migration produção | ✅ PASSOU | Somente `public.limitar_cadastro(p_chave text,p_max integer)`; antigo `limitar_cadastro(text)` preservado; execução só `service_role`; sem `qa_limpar_limites` |
| Função produção | ✅ PASSOU | `kids-auth` versão **6 ACTIVE**, `verify_jwt=false` (autenticação validada dentro da função); hash bundle `5096c41ad9bea05f6b5367ff4820ae0beefb3eaecde3e8e09d036683be1eb43a`; os arquivos index e helper foram consultados |
| Site/publicação | ✅ PASSOU | [GitHub Pages 43094778911](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43094778911), `success`; commit `18ad7ac712c9e821df987eac212434a10d3a22b7` |
| Versão e hashes HTTP públicos | ✅ PASSOU | [Smoke público 43094780247](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43094780247) · step `Teste REAL do site público — hashes, cache, QR, código, aprovação, recusa e RLS` success; index/app/SW tiveram SHA256 comparado ao checkout |
| Service Worker/cache antigo | ✅ PASSOU | Mesmo step, verificou ativação de SW v1.2.3 e remoção do cache legado em navegador emulado |
| Cadastro no endereço público, QR e código | ✅ PASSOU | Mesmo step, Chrome emulado Android e WebKit emulado iPhone |
| Cadastro pendente, uso do convite, auditoria | ✅ PASSOU | Mesmo step, consultas ao banco e Auth |
| Aprovação e login do aprovado | ✅ PASSOU | Mesmo step, JWT real com RLS |
| Recusa e acesso do recusado | ✅ PASSOU | Mesmo step, JWT real com RLS |
| Limpeza dos registros sintéticos | ✅ PASSOU | [Smoke público 43094780247](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43094780247), step `Limpeza obrigatória EXCLUSIVAMENTE de IDs exatos criados pelo teste` success; checagem própria por contas previstas e IDs |
| Conferência independente pós-limpeza | ✅ PASSOU | Consulta Supabase: 1 Auth, 1 perfil, 4 convites, 8 auditorias, 0 atribuições; `auth` e perfis marcados `zz_teste_` = 0, convites de teste = 0, auditorias com marcador = 0 |
| Plano reversão | ✅ PREPARADO / ensaiado no QA | Fonte exata de função v5 e commit antigo congelados; teste de v5 no QA passou; nenhuma falha exigiu rollback de produção |

### Contagens antes x depois do teste em produção

| Registro | Antes | Depois |
|---|---:|---:|
| `auth.users` | 1 | 1 |
| `public.perfis` | 1 | 1 |
| `public.convites` | 4 | 4 |
| `public.auditoria` | 8 | 8 |
| `public.funcoes_pessoa` | 0 | 0 |

**Nota de integridade:** `private.limites_cadastro` possui **38 registros operacionais** após os testes, inclusive históricos; hashes de IP/código não são atribuíveis com segurança a IDs sintéticos. Esses contadores **não foram apagados**, para evitar excluir registros compartilhados. O limite da janela é renovado após 1 hora, conforme SQL, mas as linhas podem continuar armazenadas até limpeza segura própria.

## 3. NÃO VERIFICADO

- Navegadores em **aparelhos Android e iPhone físicos**. Playwright testou Chrome Android emulado e WebKit iPhone emulado.
- Emissão de **novo erro sanitizado na função de produção**: o smoke bem-sucedido não produziu evento de erro; logger foi provado no QA e código inspecionado em produção.
- Diagnóstico exato do **HTTP 400 antigo do voluntário**: os logs da v5 não identificavam campo/causa; os defeitos corrigidos não o reproduziram especificamente.
- Reversão operacional em produção **não executada**, porque não houve falha. A reversão do backend v5 foi ensaiada no QA.

Esses pontos não bloqueiam o fluxo de convite automatizado já comprovado no ambiente público, mas devem ser monitorados.

## 4. Riscos restantes

- Aparelho real pode usar cache PWA anterior até aceitar aviso de atualização/reabrir.
- Erros de cadastro futuros precisam ser identificados pelo ID de correlação, sem capturar dados pessoais.
- Os registros do limitador têm hashes compartilhados e foram preservados; não excluir indiscriminadamente.
- Não prometer 100% sem falhas: WhatsApp, conexão móvel, aparelhos específicos e serviços externos podem variar.

## 5. Roteiro do celular real (cinco passos)

1. Abra https://gabriellve800-star.github.io/Escala-Kids/ no Chrome ou Safari. Se houver aviso de atualização, confirme e reabra; verifique **v1.2.3**.
2. Entre como administrador e gere **um convite novo** por QR/código.
3. No outro celular, escaneie o QR ou abra o link, preencha o cadastro com os próprios dados do participante e envie.
4. No painel do administrador, abra **Aprovações**, confira e aprove a solicitação de teste.
5. No celular do participante, entre com usuário/senha e confira o acesso do voluntário.

## 6. Estado

**✅ PRONTO PARA USO — fluxo de convite homologado e publicado**, com ressalvas dos itens acima. Testes sintéticos concluídos e limpos; dados reais preservados. Manter monitoramento das primeiras inscrições e usar ID de correlação para suporte.

### Links essenciais

- [GitHub Actions — smoke público completo](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43094780247)
- [GitHub Pages — publicação v1.2.3](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43094778911)
- [QA — versão nova, logs e regressão](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088738686)
- [Compatibilidade / rollback v5](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43088223989)
- [Plano de reversão](https://github.com/gabriellve800-star/Escala-Kids-/blob/qa/convites-20261111/auditoria/PLANO_RELEASE_ROLLBACK_V123.md)
