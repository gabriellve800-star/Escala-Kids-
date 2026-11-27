# Escala Kids — checklist de liberação do cadastro familiar
**Preparação para quinta, 26/11/2026 · cadastro assistido no domingo, 29/11/2026.**

**Estado da versão:** `v1.2.8` está no PR #7 (rascunho), **não publicada em produção**. A versão pública continua `v1.2.6`. O PR #6 de escala sugerida não faz parte deste piloto.

## 1. Infraestrutura e segurança

- [x] Restaurar Supabase **Escala Kids** e **Teste escala**; ambos voltaram para `ACTIVE_HEALTHY`.
- [x] Confirmar preservação das contagens de produção: 4 perfis, 6 convites, 0 famílias, 0 crianças, 0 turmas e 0 termos ativos.
- [x] Implantar RPC e trigger de classificação por idade exclusivamente no **Teste escala**; nenhuma migration na produção.
- [x] Validar famílias A/B, aprovação, telefone e cadastro infantil fictícios em transação com rollback.
- [ ] Configurar **SMTP próprio** para e-mails de confirmação em [Supabase Auth](https://supabase.com/dashboard/project/pntzfuxwkjreugxzovjj/auth/providers). Sem isso, o serviço de demonstração só atende emails autorizados e é limitado.
- [ ] Revisar URL oficial `https://gabriellve800-star.github.io/Escala-Kids-/` em Authentication → URL Configuration e testar confirmação/recuperação.
- [ ] Revisar rate limits, CAPTCHA e **leaked password protection**; avaliar o plano Supabase Free devido a suspensão por inatividade.
- [ ] Testar o fluxo com duas contas adultas de teste em Android Chrome e iPhone Safari, incluindo e-mail real e recuperação de acesso.
- [ ] Revisar Security Advisor após migrações e registrar evidências do login e dos testes negativos com JWT reais.

## 2. Configuração ministerial (a preencher pela liderança)

- [ ] Confirmar que Viviane pode aprovar cadastros: existe um perfil de líder ativo, **mas a permissão `pode_aprovar` está desativada em produção**. O administrador deve habilitá-la conscientemente no cadastro da liderança.
- [ ] Definir os **quatro nomes permanentes** de turmas e a idade inicial/final em meses para cada uma, **sem faixas sobrepostas** nem lacunas para crianças que a igreja atende.
- [ ] Conferir os limites com as responsáveis pelo Kids; evitar mudança de turmas ativas sem revisar as crianças que já estão nelas.
- [ ] Definir quem distribuirá códigos familiares individuais; nunca encaminhar um único convite para um grupo público.
- [ ] Definir quem conferirá presencialmente o responsável e aprovará vínculos infantis.

## 3. Consentimento e privacidade

- [ ] Completar os dados da igreja, canal de privacidade e prazo de retenção em [minuta do termo](./piloto-minuta-termo-kids.md).
- [ ] Validar a minuta com a direção e orientação jurídica; registrar **versão final aprovada**, data e responsável pela aprovação.
- [ ] Somente depois inserir uma versão **ativa** em `private.termos_kids` por procedimento controlado e auditado. Nunca usar termo de QA.
- [ ] Confirmar que o formulário exige declaração de responsável legal e aceite específico do termo; uma criança não pode ser ativada sem revisão.
- [ ] Documentar procedimento para correção, revogação e exclusão; solicitações devem chegar à administração.

## 4. Ensaios e entrada em funcionamento

- [ ] Demonstrar o QR de entrada pública (sem código secreto), com código de convite exclusivo por família.
- [ ] Confirmar que telefone é exigido, e-mail validado e cadastro fica **pendente de aprovação**.
- [ ] Verificar criança fictícia de cada faixa etária, limites no dia do aniversário, data inválida e turma não correspondente.
- [ ] Confirmar que Família A não vê Família B, voluntário sem escala não vê crianças e portaria/cozinha não ganham acesso indevido.
- [ ] Testar 100% das etapas em conexão móvel e Wi-Fi da igreja, com convite de uso único, e-mail e confirmação por liderança.
- [ ] Executar teste de recuperação: login falhou, SMTP indisponível, link expirou, celular perdido, banco fora do ar.
- [ ] Autorizar explicitamente deploy da migration, frontend, cache do PWA e somente então o termo final aprovado.
- [ ] No domingo, começar com **cadastro assistido de poucas famílias** e ampliar somente com operação estável.

### Alternativa segura se algum bloqueio permanecer no domingo

Não registrar dados infantis reais em planilhas públicas, dispositivos compartilhados ou grupos de WhatsApp. A igreja pode divulgar o QR e prestar orientações, mas **deve adiar o envio de dados de crianças** até ter confirmação de e-mail, controle de acesso e termo ativo. Se houver procedimento físico de contingência, deve usar guarda restrita e autorização adequada definida pela liderança.

## Riscos conhecidos

O serviço de e-mail padrão do Supabase **não é apropriado para produção**. O Auth do Supabase no plano Free também tem limites e risco de interrupção por inatividade. A entrega de interface com formulário não equivale a teste real de envio de e-mail; documentação e ações administrativas ainda são necessárias.

**Critério de aceite:** só chamar de *liberado para famílias* quando SMTP, termos, turmas, permissões e testes autenticados tiverem evidência positiva. **Pronto = Provado.**
