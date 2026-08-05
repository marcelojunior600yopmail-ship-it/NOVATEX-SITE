# Colocar o site no ar na Vercel

O site é feito de arquivos estáticos, então a Vercel hospeda de graça e o
deploy leva uns 2 minutos. O repositório já vem configurado — você não precisa
mexer em nada antes de publicar.

O que já está pronto:

- `vercel.json` — o endereço principal abre a **loja do Repertório Atualizado**
  e o site da Novatex continua no ar em `/novatex`
- `api/mercadopago/` — as funções de pagamento, prontas para quando você ligar
  o Mercado Pago
- `.vercelignore` — deixa de fora o que não precisa ir para o ar

---

## Caminho 1 — pelo site da Vercel (mais fácil, sem instalar nada)

1. Acesse **https://vercel.com** e entre com a sua conta do GitHub.
2. Clique em **Add New… → Project**.
3. Na lista, escolha o repositório **NOVATEX-SITE** e clique em **Import**.
4. Em **Branch**, selecione `claude/shopping-cart-system-ydy0la`
   (ou faça o merge para a `main` antes e deixe a `main`).
5. Não mude mais nada — Framework Preset fica em **Other**, os campos de build
   ficam vazios. É site estático.
6. Clique em **Deploy** e espere o "Congratulations".

Pronto. A Vercel te dá um endereço tipo `https://novatex-site.vercel.app`.

Daí em diante, **todo `git push` publica sozinho** — você mexe no
`js/shop-config.js`, faz o push, e em menos de um minuto está no ar.

## Caminho 2 — pelo terminal

```bash
npm i -g vercel      # só na primeira vez
vercel login
vercel --prod
```

---

## Domínio próprio

No painel do projeto: **Settings → Domains → Add**. Digite o domínio
(ex.: `seupendriveatualizado.com.br`) e a Vercel mostra os registros de DNS
para colar no seu provedor. O certificado HTTPS ela emite sozinha.

---

## Ligar o Mercado Pago (opcional, só quando quiser cobrar online)

Hoje o site sai do jeito que você pediu: o cliente finaliza e cai direto na sua
conversa do WhatsApp com o pedido escrito. Para cobrar online antes disso:

1. **Access Token** (secreto) — no painel da Vercel:
   **Settings → Environment Variables → Add**
   - Name: `MP_ACCESS_TOKEN`
   - Value: o token copiado do painel do Mercado Pago
   - Environment: marque **Production**, **Preview** e **Development**

   > Nunca coloque esse token em arquivo do site. Ele vai só aqui.

2. **Public Key** (pública) — em `js/shop-config.js`:

   ```js
   pagamento: {
     provedor: 'mercadopago',        // troque de 'whatsapp' para 'mercadopago'
     mercadoPago: {
       publicKey: 'APP_USR-...',     // cole a Public Key
       urlRetornoSucesso:  'https://SEU-DOMINIO.vercel.app/sucesso.html',
       urlRetornoPendente: 'https://SEU-DOMINIO.vercel.app/sucesso.html',
       urlRetornoFalha:    'https://SEU-DOMINIO.vercel.app/repertorio.html'
     }
   }
   ```

3. Faça o `git push`. A Vercel republica sozinha.

4. No painel do Mercado Pago, cadastre o webhook:
   `https://SEU-DOMINIO.vercel.app/api/mercadopago/webhook`

Mesmo com o Mercado Pago ligado, o fim da história continua igual: pagamento
aprovado → o cliente volta para a página de sucesso → e é levado para a sua
conversa no WhatsApp, onde você manda o link de download.

Se o pagamento online estiver fora do ar por algum motivo, o site **não trava**:
o checkout percebe a falha e manda o cliente para o WhatsApp do mesmo jeito.

Detalhes da integração: `mercadopago/README.md`.

---

## Depois de publicar, confira

- [ ] O endereço principal abre a loja do Repertório Atualizado
- [ ] "Adicionar ao carrinho" abre a sidebar e o total fecha em R$ 20,00
- [ ] Finalizar compra leva para a página de sucesso e abre **a sua** conversa
      no WhatsApp com o pedido escrito
- [ ] `/novatex` abre o site da Novatex
