# Testes automáticos

Na raiz do repositório, com Node >= 20, execute:

```bash
npm test
```

Para incluir 4 testes HTTP contra a função publicada (sem credenciais, sem criação de contas):

```bash
ESCALA_FUNCTION_URL=https://pntzfuxwkjreugxzovjj.supabase.co/functions/v1/kids-auth npm test
```

Os testes HTTP não criam usuários, não consomem convites e não exercitam o fluxo administrativo. Eles NÃO substituem o teste E2E com contas sintéticas isoladas, token real e limpeza.
