# Integração com o Mercado Pago

O site já está preparado para receber pagamento pelo Mercado Pago. Hoje ele sai
de fábrica no modo **WhatsApp** (o cliente finaliza e cai direto na sua
conversa). Quando você quiser cobrar online, é só seguir os 4 passos abaixo.

---

## Onde ficam as credenciais

| Credencial       | Onde colar                     | Pode aparecer no site? |
| ---------------- | ------------------------------ | ---------------------- |
| **Public Key**   | `js/shop-config.js`            | Sim — é pública        |
| **Access Token** | `mercadopago/.env`             | **Não** — é secreta    |

As duas ficam no painel do Mercado Pago:
**Seu negócio → Configurações → Gestão e administração → Credenciais**
(https://www.mercadopago.com.br/developers/panel/app).

> ⚠️ **Nunca** cole o Access Token dentro de arquivos da pasta `js/` ou `css/`.
> Tudo que está no site é visível para qualquer visitante. O Access Token
> permite movimentar a sua conta — ele fica só no servidor.
> Comece com as credenciais de **teste** e só depois troque pelas de produção.

---

## Passo 1 — Public Key no site

Abra `js/shop-config.js` e preencha:

```js
pagamento: {
  provedor: 'mercadopago',            // <- troque de 'whatsapp' para 'mercadopago'

  mercadoPago: {
    publicKey: 'APP_USR-...',         // <- COLE AQUI A PUBLIC KEY

    endpointCriarPreferencia: '/api/mercadopago/criar-preferencia',

    // quando o site estiver publicado, use o endereço completo:
    urlRetornoSucesso:  'https://seudominio.com.br/sucesso.html',
    urlRetornoPendente: 'https://seudominio.com.br/sucesso.html',
    urlRetornoFalha:    'https://seudominio.com.br/repertorio.html'
  }
}
```

## Passo 2 — Access Token no servidor

```bash
cd mercadopago
cp .env.example .env
```

Abra o `.env` e cole o token:

```
MP_ACCESS_TOKEN=APP_USR-0000000000000000-000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-000000000
```

O `.env` está no `.gitignore` — ele não vai para o GitHub.

## Passo 3 — Suba o servidor

```bash
cd mercadopago
npm install
npm start
```

O servidor sobe na porta `3000` e já serve o site inteiro junto, então
`http://localhost:3000/repertorio.html` funciona com o pagamento ligado.

## Passo 4 — Teste

1. Adicione o produto ao carrinho e finalize.
2. Você deve ser levado ao checkout do Mercado Pago.
3. Pague com um [cartão de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/test-cards).
4. O Mercado Pago devolve o cliente para `sucesso.html`, que mostra o resumo e
   leva a pessoa para o seu WhatsApp com o pedido escrito — é lá que você manda
   o link de download.

---

## Como o fluxo funciona

```
  site (navegador)                 seu servidor              Mercado Pago
  ────────────────                 ────────────              ────────────
  finaliza a compra
        │
        │  POST /api/mercadopago/criar-preferencia
        │  (itens, total, dados do cliente)
        ├──────────────────────────────►
        │                          usa o ACCESS TOKEN
        │                          ├───────────────────────────►
        │                          │        cria a preferência
        │                          ◄───────────────────────────┤
        │        { init_point }    │
        ◄──────────────────────────┤
        │
        │  o cliente vai pagar
        ├────────────────────────────────────────────────────►
        │
        │  volta para sucesso.html?status=approved&payment_id=…
        ◄────────────────────────────────────────────────────┤
        │
        └──► abre o WhatsApp com o pedido pronto
```

## Webhook (opcional, mas recomendado)

A volta pela URL depende do cliente não fechar a aba. Para ter certeza do
pagamento, ative o webhook no painel do Mercado Pago apontando para:

```
https://seudominio.com.br/api/mercadopago/webhook
```

O `server.js` já tem essa rota pronta, com o lugar marcado para você registrar
o pedido pago (planilha, banco, e-mail, o que preferir).

## Hospedagem sem servidor

Se o site estiver em algum lugar que só serve arquivos (GitHub Pages, Netlify
estático), não dá para guardar o Access Token com segurança. Nesse caso:

- deixe `provedor: 'whatsapp'` — funciona 100% e o pagamento é combinado na
  conversa (Pix cai na hora); ou
- publique só o `server.js` em um serviço com Node (Render, Railway, Fly.io,
  Vercel Functions) e aponte o `endpointCriarPreferencia` para ele.

Se o servidor estiver fora do ar, o site **não trava**: o checkout percebe a
falha e manda o cliente para o WhatsApp do mesmo jeito.
