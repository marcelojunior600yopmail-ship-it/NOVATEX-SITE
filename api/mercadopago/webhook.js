/* ==========================================================================
   MERCADO PAGO — webhook (função da Vercel)
   --------------------------------------------------------------------------
   O Mercado Pago chama este endereço sempre que um pagamento muda de status.
   É o jeito confiável de saber que o pedido foi pago, mesmo que o cliente
   feche a aba antes de voltar para o site.

   No painel do Mercado Pago, cadastre:
     https://SEU-DOMINIO.vercel.app/api/mercadopago/webhook

   O ACCESS TOKEN vem da variável de ambiente MP_ACCESS_TOKEN, configurada em
   Settings > Environment Variables no projeto da Vercel.
   ========================================================================== */
'use strict';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Responde rápido: o Mercado Pago reenvia o aviso se demorar.
  res.status(200).end();

  const aviso = req.body || {};
  if (aviso.type !== 'payment' || !aviso.data || !aviso.data.id || !ACCESS_TOKEN) return;

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
           pagamento.external_reference  -> número do pedido (ex.: SP260805-1234)
           pagamento.payer.email         -> e-mail do cliente
           pagamento.transaction_amount  -> valor pago

         Os logs aparecem em: painel da Vercel > seu projeto > Logs.
         ================================================================= */
    }
  } catch (e) {
    console.error('[mercadopago] falha ao consultar o pagamento:', e);
  }
};
