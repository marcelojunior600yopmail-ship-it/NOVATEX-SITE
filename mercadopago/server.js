/* ==========================================================================
   SERVIDOR DE PAGAMENTO — MERCADO PAGO
   --------------------------------------------------------------------------
   Servidor pequeno, só para guardar o Access Token e criar a preferência de
   pagamento. Ele também serve os arquivos do site, então dá para rodar tudo
   com um comando só:

       cd mercadopago && npm install && npm start
       -> http://localhost:3000/repertorio.html

   >>> O ACCESS TOKEN NÃO FICA AQUI. <<<
   Ele fica no arquivo mercadopago/.env (veja mercadopago/.env.example).
   ========================================================================== */
'use strict';

const path = require('path');
const express = require('express');

require('dotenv').config({ path: path.join(__dirname, '.env') });

/* ====================== CREDENCIAIS ====================== */
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PORTA = process.env.PORT || 3000;
const RAIZ_SITE = path.join(__dirname, '..');

if (!ACCESS_TOKEN || ACCESS_TOKEN.indexOf('COLE_AQUI') === 0) {
  console.warn('\n⚠️  MP_ACCESS_TOKEN não configurado.');
  console.warn('   Copie mercadopago/.env.example para mercadopago/.env e cole o token.');
  console.warn('   O site continua funcionando no modo WhatsApp.\n');
}

const app = express();
app.use(express.json());
app.use(express.static(RAIZ_SITE));

/* ====================== CRIAR PREFERÊNCIA ======================
   Recebe o pedido do checkout e devolve o endereço do Mercado Pago
   para onde o cliente deve ser levado.
   ============================================================== */
app.post('/api/mercadopago/criar-preferencia', async (req, res) => {
  if (!ACCESS_TOKEN) {
    return res.status(503).json({ erro: 'pagamento_indisponivel' });
  }

  const pedido = req.body || {};
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

  if (!itens.length) {
    return res.status(400).json({ erro: 'pedido_sem_itens' });
  }

  // O desconto do cupom entra como um item negativo, para o total bater
  // com o que o cliente viu no carrinho.
  const itensMP = itens.map((i) => ({
    id: String(i.id),
    title: String(i.titulo).slice(0, 250),
    quantity: Number(i.quantidade) || 1,
    unit_price: Number(i.precoUnitario) || 0,
    currency_id: 'BRL'
  }));

  if (Number(pedido.desconto) > 0) {
    itensMP.push({
      id: 'desconto',
      title: 'Desconto',
      quantity: 1,
      unit_price: -Math.abs(Number(pedido.desconto)),
      currency_id: 'BRL'
    });
  }

  const pagador = pedido.pagador || {};
  const retorno = pedido.retorno || {};

  // O Mercado Pago exige endereços completos no back_urls; a configuração do
  // site guarda caminhos curtos ('sucesso.html'), então completamos aqui.
  const absoluta = (url) => {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocolo = req.headers['x-forwarded-proto'] || 'http';
    return `${protocolo}://${host}/${String(url).replace(/^\//, '')}`;
  };

  const preferencia = {
    items: itensMP,
    payer: {
      name: pagador.nome || undefined,
      email: pagador.email || undefined,
      phone: pagador.telefone
        ? { area_code: String(pagador.telefone).slice(0, 2), number: String(pagador.telefone).slice(2) }
        : undefined
    },
    // volta para a página de sucesso, que leva o cliente ao WhatsApp
    back_urls: {
      success: absoluta(retorno.sucesso),
      pending: absoluta(retorno.pendente),
      failure: absoluta(retorno.falha)
    },
    auto_return: 'approved',
    // o número do pedido volta junto na notificação
    external_reference: pedido.pedidoId,
    statement_descriptor: 'PENDRIVE ATUALIZADO',
    notification_url: process.env.MP_WEBHOOK_URL || undefined
  };

  try {
    const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(preferencia)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error('[mercadopago] erro ao criar preferência:', dados);
      return res.status(502).json({ erro: 'falha_mercadopago', detalhe: dados.message });
    }

    res.json({
      id: dados.id,
      init_point: dados.init_point,
      sandbox_init_point: dados.sandbox_init_point
    });
  } catch (e) {
    console.error('[mercadopago] indisponível:', e);
    res.status(502).json({ erro: 'falha_mercadopago' });
  }
});

/* ====================== WEBHOOK ======================
   O Mercado Pago avisa aqui quando o pagamento muda de status.
   É o jeito confiável de saber que o pedido foi pago, mesmo que o
   cliente feche a aba antes de voltar para o site.
   ==================================================== */
app.post('/api/mercadopago/webhook', async (req, res) => {
  // Responde rápido: o Mercado Pago reenvia se demorar.
  res.sendStatus(200);

  const aviso = req.body || {};
  if (aviso.type !== 'payment' || !aviso.data || !aviso.data.id) return;

  try {
    const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${aviso.data.id}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const pagamento = await resposta.json();

    console.log('[mercadopago] pagamento %s: %s (pedido %s)',
      pagamento.id, pagamento.status, pagamento.external_reference);

    if (pagamento.status === 'approved') {
      /* =================================================================
         >>> AQUI VOCÊ REGISTRA O PEDIDO PAGO <<<

         Neste ponto o pagamento está confirmado. É o lugar de, por exemplo:
           • gravar o pedido em uma planilha ou banco de dados;
           • enviar o link de download por e-mail;
           • disparar uma mensagem automática no WhatsApp.

         Dados disponíveis:
           pagamento.external_reference  -> número do pedido (ex.: SP260804-1234)
           pagamento.payer.email         -> e-mail do cliente
           pagamento.transaction_amount  -> valor pago
         ================================================================= */
    }
  } catch (e) {
    console.error('[mercadopago] falha ao consultar o pagamento:', e);
  }
});

app.listen(PORTA, () => {
  console.log(`\n🎧 Seu Pendrive Atualizado`);
  console.log(`   site:      http://localhost:${PORTA}/repertorio.html`);
  console.log(`   pagamento: ${ACCESS_TOKEN ? 'Mercado Pago ligado' : 'modo WhatsApp (sem token)'}\n`);
});
