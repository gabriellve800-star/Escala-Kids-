# Validação de rede compartilhada (QA)

A versão em produção usa uma chave por IP aparente, com 20 tentativas por hora. A 21ª foi negada em teste SQL com ROLLBACK.

Proposta testada **somente dentro de uma transação revertida**: para uma chave com `p_max=60`, tentativas 1–60 permitidas, 61ª negada; uma segunda chave não foi afetada. Saída: `PASS: 60 requisicoes mesma chave permitidas; 61a negada; outra chave permitida; rollback total`.

Para ambientes de QA isolados, aplicar o SQL proposto antes de publicar a função nova; executar toda a bateria E2E e RLS. **Não usar a função desse ramo em produção sem executar a alteração SQL e todos os testes críticos.**

Limites propostos: 120/h por IP para validação de convite, 60/h por código/IP, 80/h por IP para cadastro, 60/h por código/IP, 120/h por IP para login e 10/h por usuário. Revisar abusos e cabeçalhos de IP atrás do proxy (WAF/CAPTCHA recomendado para exposição pública).
