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
