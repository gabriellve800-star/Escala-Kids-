# Escala Kids v1.2.4 — Relatório de homologação e publicação controlada

**Data:** 11/11/2026 (America/Sao_Paulo)  
**Estado:** ✅ PUBLICADO E HOMOLOGADO — navegadores emulados e smoke público concluídos; celulares físicos ainda não verificados  
**URL:** https://gabriellve800-star.github.io/Escala-Kids-/  
**GitHub main:** `3c9d6b1e81d8c582f9a34db213bbab0b545173f8`  
**Função kids-auth:** v7 ACTIVE; mesmo hash `5096c41ad9bea05f6b5367ff4820ae0beefb3eaecde3e8e09d036683be1eb43a`

## 1. Resumo

A área **Minha Escala** substitui o ícone de disponibilidade do voluntário. Apresenta próxima escala (data, horário, culto, turma e função) e mês de serviços; logo abaixo, calendário para indicar disponibilidade no **mês seguinte**. Domingo aceita manhã e noite separadamente, quarta aceita noite. Liderança/admin possuem gestão para atribuir e excluir escalas e consultar as disponibilidades.

**Fluxos anteriores preservados:** cadastro por convite, QR e código, aprovação/recusa, login, perfis e permissões, auditoria e serviço kids-auth.

## 2. Testes e evidências

| Teste | Resultado | Evidência |
|---|---|---|
| Código e regressão da branch | ✅ 13/13 | [Actions 43139516034](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139516034) |
| QA banco real, funções e integração | ✅ 81/81 | [Actions 43139402875](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139402875) |
| QA Android Chrome + iPhone WebKit | ✅ 14/14 | Mesmo run; login de voluntário, próxima turma Maternal, disponibilidade salva e 12 testes de cadastro/cache legados |
| RLS das duas tabelas | ✅ | Inserção somente de disponibilidade própria no mês seguinte; leitura própria; gestores publicam/removem escalas; voluntário não atribui escalas |
| Limpeza QA | ✅ zero | Consulta direta: 0 Auth, perfis, convites, escalas e disponibilidades |
| Migration em produção | ✅ | Exclusivamente `public.escalas` e `public.disponibilidades`; ambas com RLS e 7 policies, sem alteração das antigas tabelas |
| Pages v1.2.4 | ✅ | [Actions 43139999412](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139999412) |
| Smoke público: hashes, cache, QR, código, aprovação, recusa e RLS | ✅ | [Actions 43139999263](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139999263) |
| Smoke público: card próxima escala e disponibilidade | ✅ | Mesmo run; `PROD_SMOKE_AGENDA_OK` |
| Limpeza exata em produção | ✅ | Mesmo run; `PROD_SMOKE_CLEAN_ZERO` com contagens idênticas |

### Dados reais antes e depois da produção

| Registro | Antes | Depois |
|---|---:|---:|
| Auth | 3 | 3 |
| Perfis | 3 | 3 |
| Convites | 6 | 6 |
| Auditoria | 14 | 14 |
| Atribuições de funções | 0 | 0 |
| Escalas | 0 | 0 |
| Disponibilidades | 0 | 0 |

Consulta independente pós-smoke: 0 contas Auth e 0 perfis com identificadores sintéticos; 0 escalas e 0 disponibilidades restantes.

## 3. Incidente de teste e correção

Durante QA, a primeira instalação do service worker disparava `controllerchange` e recarregava a página em meio ao preenchimento do login. A versão v1.2.4 agora só recarrega após o usuário aceitar o aviso de atualização. O teste browser final provou inputs válidos, autenticação real HTTP 200, a tela Minha Escala visível e sem erros JavaScript.

## 4. Limitações / NÃO VERIFICADO

- Android/iPhone físicos, diferenças de câmera, sistema operacional ou conexão móvel. Foram testados navegadores emulados.
- Escalas futuras reais só aparecem depois que a liderança as publica. Não foram adicionadas escalas fictícias a pessoas reais.
- Política automática de geração/distribuição de escalas, check-in e avisos ainda não faz parte deste módulo.
- Reversão em produção não foi necessária; em falha futura, o front-end pode ser restaurado ao commit `08c0d7d3452298e398799f612cc4318ca4fbe04b`. As novas tabelas são aditivas e não exigem exclusão; a função kids-auth não mudou.

## 5. Teste manual no celular

1. Abra a [URL pública](https://gabriellve800-star.github.io/Escala-Kids-/). Caso apareça **Nova versão disponível**, toque em **Atualizar**, depois confirme **v1.2.4**.
2. Acesse como **administrador ou líder**, abra **Escalas**, escolha voluntário, data, culto, horário, turma e função e publique uma escala real de teste.
3. No login do **voluntário**, abra **Minha Escala**: a próxima escala deve aparecer em destaque e no calendário.
4. No calendário de **mês seguinte**, toque no domingo e selecione manhã e/ou noite; confira também as quartas-feiras à noite.
5. Como liderança, abra **Escalas** para confirmar a disponibilidade salva. Remova a escala de teste criada, se não for usá-la.

## Links

- [PR da v1.2.4](https://github.com/gabriellve800-star/Escala-Kids-/pull/2)
- [QA verde 81/81 + 14/14](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139402875)
- [Site Pages](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139999412)
- [Smoke público e limpeza](https://github.com/gabriellve800-star/Escala-Kids-/actions/runs/43139999263)
