/* ==========================================================================
   PÁGINA DE SUCESSO
   --------------------------------------------------------------------------
   Faz três coisas:
     1. lê o pedido que o checkout gravou no navegador;
     2. monta a mensagem de WhatsApp já com o pedido escrito;
     3. leva o cliente para a conversa (sozinho, depois de alguns segundos).

   Também entende a volta do Mercado Pago: quando o cliente é devolvido para
   cá, o status do pagamento vem na própria URL (?status=approved&payment_id=…)
   e entra na mensagem.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var CFG = window.LOJA || {};
  var $ = function (s) { return document.querySelector(s); };

  var CHAVE_PEDIDO = (CFG.carrinho && CFG.carrinho.chavePedido) || 'loja:ultimo-pedido';
  var CHAVE_CARRINHO = (CFG.carrinho && CFG.carrinho.chaveArmazenamento) || 'loja:carrinho';

  var formatador = new Intl.NumberFormat(CFG.locale || 'pt-BR', {
    style: 'currency', currency: CFG.moeda || 'BRL'
  });
  function fmt(v) { return formatador.format(Number(v) || 0); }

  /* ====================== 1. DADOS ====================== */
  function parametros() {
    var p = {};
    var busca = window.location.search.replace(/^\?/, '');
    if (!busca) return p;
    busca.split('&').forEach(function (par) {
      var partes = par.split('=');
      p[decodeURIComponent(partes[0])] = decodeURIComponent((partes[1] || '').replace(/\+/g, ' '));
    });
    return p;
  }

  function lerPedido() {
    try {
      return JSON.parse(window.localStorage.getItem(CHAVE_PEDIDO) || 'null');
    } catch (e) { return null; }
  }

  function limparCarrinho() {
    try { window.localStorage.removeItem(CHAVE_CARRINHO); } catch (e) { /* segue */ }
  }

  /* ====================== 2. STATUS DO PAGAMENTO ====================== */
  // O Mercado Pago pode devolver 'status' ou 'collection_status'.
  function statusPagamento(params) {
    var bruto = params.status || params.collection_status || '';
    if (bruto === 'approved') return { chave: 'aprovado', rotulo: 'Pagamento aprovado' };
    if (bruto === 'pending' || bruto === 'in_process') return { chave: 'pendente', rotulo: 'Pagamento em análise' };
    if (bruto === 'rejected') return { chave: 'recusado', rotulo: 'Pagamento não aprovado' };
    return { chave: 'aguardando', rotulo: '' };
  }

  /* ====================== 3. MENSAGEM DO WHATSAPP ====================== */
  function montarMensagem(pedido, pagamento, params) {
    var linhas = [];

    linhas.push(pedido
      ? 'Olá! Acabei de finalizar meu pedido no site. 🎧'
      : 'Olá! Vim pelo site e quero comprar o repertório. 🎧');
    linhas.push('');

    if (pedido) {
      linhas.push('*Pedido:* ' + pedido.id);
      if (pedido.cliente) {
        if (pedido.cliente.nome) linhas.push('*Nome:* ' + pedido.cliente.nome);
        if (pedido.cliente.email) linhas.push('*E-mail:* ' + pedido.cliente.email);
      }
      linhas.push('');
      linhas.push('*Itens:*');
      (pedido.itens || []).forEach(function (i) {
        linhas.push('• ' + i.qtd + 'x ' + i.nome + ' — ' + fmt(i.subtotal));
      });

      if (pedido.totais && pedido.totais.desconto > 0) {
        linhas.push('Desconto (' + pedido.totais.cupom + '): −' + fmt(pedido.totais.desconto));
      }

      linhas.push('');
      linhas.push('*Total: ' + fmt(pedido.totais ? pedido.totais.total : 0) + '*');
    } else {
      linhas.push('Quero comprar o *Repertório Atualizado*.');
    }

    if (pagamento.chave === 'aprovado') {
      linhas.push('');
      linhas.push('*Pagamento aprovado no Mercado Pago*' +
        (params.payment_id ? ' (ID ' + params.payment_id + ')' : ''));
    } else if (pagamento.chave === 'pendente') {
      linhas.push('');
      linhas.push('*Pagamento em análise no Mercado Pago*' +
        (params.payment_id ? ' (ID ' + params.payment_id + ')' : ''));
    }

    linhas.push('');
    linhas.push('Pode me enviar o link para download, por favor?');

    return linhas.join('\n');
  }

  function linkWhatsApp(mensagem) {
    var numero = (CFG.whatsapp && CFG.whatsapp.numero) || '';
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem);
  }

  /* ====================== 4. RESUMO NA TELA ====================== */
  function renderizarPedido(pedido, pagamento) {
    var caixa = $('#suc-pedido');
    if (!caixa || !pedido) return;

    var itens = (pedido.itens || []).map(function (i) {
      return '<li><span>' + i.qtd + '× ' + i.nome + '</span><span>' + fmt(i.subtotal) + '</span></li>';
    }).join('');

    var desconto = (pedido.totais && pedido.totais.desconto > 0)
      ? '<li class="is-off"><span>Desconto · ' + pedido.totais.cupom + '</span><span>−' +
        fmt(pedido.totais.desconto) + '</span></li>'
      : '';

    caixa.innerHTML =
      '<div class="sucesso__pedido-topo">' +
        '<span>Pedido</span><strong>' + pedido.id + '</strong>' +
      '</div>' +
      '<ul class="sucesso__itens">' + itens + desconto + '</ul>' +
      '<div class="sucesso__total"><span>Total</span><strong>' +
        fmt(pedido.totais ? pedido.totais.total : 0) + '</strong></div>' +
      (pagamento.rotulo
        ? '<p class="sucesso__status is-' + pagamento.chave + '">' + pagamento.rotulo + '</p>'
        : '');

    caixa.hidden = false;
  }

  function ajustarTextos(pedido, pagamento) {
    if (pagamento.chave === 'recusado') {
      $('#suc-titulo').textContent = 'Pagamento não aprovado';
      $('#suc-eyebrow').innerHTML = '<span class="eyebrow__dot" aria-hidden="true"></span>Quase lá';
      $('#suc-lead').innerHTML =
        'O pagamento não foi aprovado, mas o pedido não se perdeu. ' +
        'Chame no WhatsApp que a gente finaliza por lá — normalmente por Pix, ' +
        'que cai na hora.';
      $('#suc-ico').classList.add('is-alerta');
      return;
    }

    if (pagamento.chave === 'pendente') {
      $('#suc-titulo').textContent = 'Pagamento em análise';
      $('#suc-lead').innerHTML =
        'Assim que o pagamento for confirmado, liberamos o link. ' +
        'Chame no WhatsApp para acompanhar — a mensagem já vai pronta.';
      return;
    }

    if (!pedido) {
      $('#suc-titulo').textContent = 'Fale com a gente';
      $('#suc-eyebrow').innerHTML = '<span class="eyebrow__dot" aria-hidden="true"></span>WhatsApp';
      $('#suc-lead').innerHTML =
        'Não encontramos um pedido salvo neste navegador. Sem problema: ' +
        'chame no WhatsApp que a gente resolve por lá.';
    }
  }

  /* ====================== 5. CONTAGEM E REDIRECIONAMENTO ====================== */
  function redirecionar(url) {
    var segundos = CFG.whatsapp && CFG.whatsapp.redirecionarEmSegundos;
    segundos = (segundos === 0 || segundos) ? Number(segundos) : 3;

    var alvo = $('#suc-contagem');

    if (segundos <= 0) { window.location.href = url; return; }

    var restante = segundos;
    var escrever = function () {
      if (alvo) {
        alvo.textContent = 'Abrindo o WhatsApp em ' + restante +
          (restante === 1 ? ' segundo…' : ' segundos…');
      }
    };
    escrever();

    var timer = window.setInterval(function () {
      restante -= 1;
      if (restante > 0) { escrever(); return; }

      window.clearInterval(timer);
      if (alvo) alvo.textContent = 'Abrindo o WhatsApp…';
      window.location.href = url;
    }, 1000);

    // se a pessoa clicar antes, a contagem para
    var botao = $('#suc-wa');
    if (botao) {
      botao.addEventListener('click', function () {
        window.clearInterval(timer);
        if (alvo) alvo.textContent = '';
      });
    }
  }

  /* ====================== 6. START ====================== */
  function iniciar() {
    var params = parametros();
    var pedido = lerPedido();
    var pagamento = statusPagamento(params);

    // Se a URL trouxe um número de pedido diferente do que está salvo,
    // o resumo salvo não serve — melhor não mostrar dado de outro pedido.
    if (params.pedido && pedido && pedido.id !== params.pedido) pedido = null;

    // Guarda o status do pagamento junto do pedido (útil para conferência).
    if (pedido && pagamento.chave !== 'aguardando') {
      pedido.pagamento = pedido.pagamento || {};
      pedido.pagamento.status = pagamento.chave;
      if (params.payment_id) pedido.pagamento.idPagamento = params.payment_id;
      try { window.localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido)); } catch (e) { /* segue */ }
    }

    // O pedido virou conversa: o carrinho pode ser esvaziado.
    if (pagamento.chave !== 'recusado') limparCarrinho();

    ajustarTextos(pedido, pagamento);
    renderizarPedido(pedido, pagamento);

    var mensagem = montarMensagem(pedido, pagamento, params);
    var url = linkWhatsApp(mensagem);

    var botao = $('#suc-wa');
    if (botao) {
      botao.href = url;
      botao.target = '_blank';
      botao.rel = 'noopener';
    }

    // links de apoio no rodapé do card
    Array.prototype.slice.call(document.querySelectorAll('[data-wa-link]')).forEach(function (el) {
      var texto = el.getAttribute('data-wa-texto') || 'Olá!';
      el.href = 'https://wa.me/' + ((CFG.whatsapp && CFG.whatsapp.numero) || '') +
                '?text=' + encodeURIComponent(texto);
      el.target = '_blank';
      el.rel = 'noopener';
    });
    if (CFG.whatsapp && CFG.whatsapp.exibicao) {
      Array.prototype.slice.call(document.querySelectorAll('[data-wa-exibicao]')).forEach(function (el) {
        el.textContent = CFG.whatsapp.exibicao;
      });
    }

    redirecionar(url);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

})(window, document);
