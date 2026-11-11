# Decisões técnicas — Escala Kids

- 11/11/2026: PRONTO só com testes reais ponta a ponta, segurança e limpeza comprovada.
- 11/11/2026: Este ramo de QA mantém o código fiel à função em produção v5 para reproduzir antes de corrigir.
- 11/11/2026: O teste real de criação de conta sintética por HTTP foi bloqueado pela ferramenta; não contornar a proteção.
- 11/11/2026: O limitador por IP compartilhado falha na 21ª tentativa/hora; causa demonstrada em SQL transacional.
- 11/11/2026: A função ignora o resultado de deleteUser durante o rollback; risco de conta órfã, teste vermelho.
- 11/11/2026: QA em branch separada, sem publicar correções não comprovadas em produção.
