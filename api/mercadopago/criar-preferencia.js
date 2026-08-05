/* ==========================================================================
   MERCADO PAGO — criar preferência de pagamento (função da Vercel)
   --------------------------------------------------------------------------
   Mesma coisa que o mercadopago/server.js faz na sua máquina, só que rodando
   na Vercel. O site chama POST /api/mercadopago/criar-preferencia e recebe o
   endereço do checkout do Mercado Pago.

   >>> O ACCESS TOKEN NÃO FICA NESTE ARQUIVO. <<<
   Ele é uma variável de ambiente do projeto na Vercel:

     Painel da Vercel > seu projeto > Settings > Environment Variables
       Name:  MP_ACCESS_TOKEN
       Value: APP_USR-... (copiado do painel do Mercado Pago)

   Depois de salvar, faça um novo deploy para a variável valer.
   ========================================================================== */
'use strict';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

/* O Mercado Pago exige endereços completos no back_urls. A configuração do
   site guarda caminhos curtos ('sucesso.html'), então completamos aqui com o
   domínio de quem fez a chamada. */
function absoluta(url, req) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocolo = req.headers['x-forwarded-proto'] || 'https';
  return `${protocolo}://${host}/${String(url).replace(/^\//, '')}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'metodo_nao_permitido' });
  }

  if (!ACCESS_TOKEN) {
    // Sem token configurado o site não quebra: o checkout percebe a falha e
    // manda o cliente para o WhatsApp.
    return res.status(503).json({ erro: 'pagamento_indisponivel' });
  }

  const pedido = req.body || {};
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

  if (!itens.length) {
    return res.status(400).json({ erro: 'pedido_sem_itens' });
  }

  const itensMP = itens.map((i) => ({
    id: String(i.id),
    title: String(i.titulo).slice(0, 250),
    quantity: Number(i.quantidade) || 1,
    unit_price: Number(i.precoUnitario) || 0,
    currency_id: 'BRL'
  }));

  // O desconto do cupom entra como item negativo, para o total bater com o
  // que o cliente viu no carrinho.
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

  const preferencia = {
    items: itensMP,
    payer: {
      name: pagador.nome || undefined,
      email: pagador.email || undefined,
      phone: pagador.telefone
        ? {
            area_code: String(pagador.telefone).slice(0, 2),
            number: String(pagador.telefone).slice(2)
          }
        : undefined
    },
    back_urls: {
      success: absoluta(retorno.sucesso, req),
      pending: absoluta(retorno.pendente, req),
      failure: absoluta(retorno.falha, req)
    },
    auto_return: 'approved',
    external_reference: pedido.pedidoId,
    statement_descriptor: 'PENDRIVE ATUALIZADO',
    notification_url: absoluta('api/mercadopago/webhook', req)
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

    return res.status(200).json({
      id: dados.id,
      init_point: dados.init_point,
      sandbox_init_point: dados.sandbox_init_point
    });
  } catch (e) {
    console.error('[mercadopago] indisponível:', e);
    return res.status(502).json({ erro: 'falha_mercadopago' });
  }
};
