/* ==========================================================================
   CHECKOUT
   --------------------------------------------------------------------------
   Modal de finalização: nome, e-mail, telefone, resumo do pedido e total.
   Ao confirmar, o pedido é gravado no navegador e o cliente segue para a
   página de sucesso — que o leva direto para a conversa no WhatsApp.

   Dois caminhos, escolhidos em js/shop-config.js (LOJA.pagamento.provedor):

     'whatsapp'    -> vai direto para sucesso.html (padrão hoje)
     'mercadopago' -> cria a preferência no seu servidor, manda o cliente para
                      o checkout do Mercado Pago e, quando o pagamento é
                      aprovado, o Mercado Pago devolve o cliente para
                      sucesso.html — que segue para o WhatsApp do mesmo jeito.

   Onde ficam as credenciais: js/shop-config.js (Public Key) e
   mercadopago/.env (Access Token, no servidor). Veja mercadopago/README.md.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var CFG = window.LOJA;
  if (!CFG) return;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CHAVE_PEDIDO = (CFG.carrinho && CFG.carrinho.chavePedido) || 'loja:ultimo-pedido';
  var CHAVE_CLIENTE = 'pendrive:cliente';

  var modal, overlay, form, resumoEl, totalEl, botao, ultimoFoco = null, aberto = false;

  /* ====================== 1. HTML DO MODAL ====================== */
  function montar() {
    var raiz = document.createElement('div');
    raiz.className = 'checkout-root';
    raiz.innerHTML =
      '<div class="checkout-overlay" id="ck-overlay" hidden></div>' +

      '<div class="checkout" id="ck-modal" role="dialog" aria-modal="true" aria-labelledby="ck-title" hidden>' +
        '<button class="checkout__close" type="button" id="ck-close" aria-label="Fechar checkout">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +

        '<div class="checkout__grid">' +

          '<div class="checkout__form-col">' +
            '<p class="checkout__eyebrow">Passo final</p>' +
            '<h2 class="checkout__title" id="ck-title">Seus dados</h2>' +
            '<p class="checkout__lead">É com esses dados que a gente confirma o pedido e envia o link de download.</p>' +

            '<form class="ck-form" id="ck-form" novalidate>' +
              '<div class="field">' +
                '<label for="ck-nome">Nome completo</label>' +
                '<input id="ck-nome" name="nome" type="text" autocomplete="name"' +
                ' placeholder="Como você se chama" required aria-describedby="ck-nome-erro">' +
                '<p class="field__erro" id="ck-nome-erro" role="alert"></p>' +
              '</div>' +

              '<div class="field">' +
                '<label for="ck-email">E-mail</label>' +
                '<input id="ck-email" name="email" type="email" autocomplete="email"' +
                ' inputmode="email" placeholder="voce@email.com" required aria-describedby="ck-email-erro">' +
                '<p class="field__erro" id="ck-email-erro" role="alert"></p>' +
              '</div>' +

              '<div class="field">' +
                '<label for="ck-tel">Telefone / WhatsApp</label>' +
                '<input id="ck-tel" name="telefone" type="tel" autocomplete="tel"' +
                ' inputmode="tel" placeholder="(33) 99999-0000" required aria-describedby="ck-tel-erro">' +
                '<p class="field__erro" id="ck-tel-erro" role="alert"></p>' +
              '</div>' +

              '<p class="ck-form__nota">Seus dados ficam só neste pedido. Não enviamos spam.</p>' +
            '</form>' +
          '</div>' +

          '<aside class="checkout__resumo">' +
            '<h3 class="checkout__resumo-title">Resumo do pedido</h3>' +
            '<ul class="ck-itens" id="ck-itens"></ul>' +
            '<div class="ck-totais" id="ck-totais"></div>' +

            '<button class="btn btn--neon btn--block checkout__submit" type="submit" form="ck-form" id="ck-submit">' +
              '<span class="checkout__submit-txt">Finalizar compra</span>' +
              '<span class="checkout__submit-total" id="ck-total-btn"></span>' +
              '<span class="loader" aria-hidden="true"><i></i><i></i><i></i></span>' +
            '</button>' +

            '<p class="checkout__pay" id="ck-pay-note"></p>' +

            '<ul class="checkout__selos">' +
              '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg> Compra segura</li>' +
              '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></svg> Download imediato</li>' +
              '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg> Suporte no WhatsApp</li>' +
            '</ul>' +
          '</aside>' +

        '</div>' +

        '<div class="checkout__loading" id="ck-loading" hidden>' +
          '<span class="ring" aria-hidden="true"></span>' +
          '<p class="checkout__loading-txt" id="ck-loading-txt">Confirmando seu pedido…</p>' +
          '<p class="checkout__loading-sub">Não feche esta janela.</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(raiz);

    modal    = $('#ck-modal', raiz);
    overlay  = $('#ck-overlay', raiz);
    form     = $('#ck-form', raiz);
    resumoEl = $('#ck-itens', raiz);
    totalEl  = $('#ck-totais', raiz);
    botao    = $('#ck-submit', raiz);

    $('#ck-pay-note', raiz).textContent = CFG.pagamento && CFG.pagamento.provedor === 'mercadopago'
      ? 'Você será levado ao ambiente seguro do Mercado Pago (Pix, cartão ou boleto).'
      : 'Ao finalizar, você cai direto na nossa conversa do WhatsApp para combinar o pagamento e receber o link.';

    ligarEventos();
  }

  /* ====================== 2. ABRIR / FECHAR ====================== */
  function abrir() {
    var totais = window.Carrinho.totais();
    if (!totais.quantidade) return;

    renderizarResumo();
    preencherSalvo();

    ultimoFoco = document.activeElement;
    overlay.hidden = false;
    modal.hidden = false;
    void modal.offsetWidth;

    document.body.classList.add('checkout-open');
    overlay.classList.add('is-on');
    modal.classList.add('is-on');
    aberto = true;

    window.setTimeout(function () {
      var campo = $('#ck-nome');
      if (campo && !campo.value) campo.focus();
    }, reduzido ? 0 : 260);

    document.addEventListener('keydown', teclado);
  }

  function fechar() {
    if (!aberto) return;
    aberto = false;

    overlay.classList.remove('is-on');
    modal.classList.remove('is-on');
    document.body.classList.remove('checkout-open');
    document.removeEventListener('keydown', teclado);

    window.setTimeout(function () {
      if (aberto) return;
      overlay.hidden = true;
      modal.hidden = true;
    }, reduzido ? 0 : 300);

    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function teclado(ev) {
    if (ev.key === 'Escape' && !modal.classList.contains('is-loading')) { fechar(); return; }
    if (ev.key !== 'Tab') return;

    var focaveis = $$('button, [href], input, select, textarea', modal)
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!focaveis.length) return;

    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  }

  /* ====================== 3. RESUMO ====================== */
  function renderizarResumo() {
    var itens = window.Carrinho.itens();
    var t = window.Carrinho.totais();
    var fmt = window.Carrinho.formatar;

    resumoEl.innerHTML = itens.map(function (i) {
      return '' +
        '<li class="ck-item">' +
          '<img class="ck-item__img" src="' + i.imagem + '" alt="" width="88" height="88" loading="lazy">' +
          '<div>' +
            '<p class="ck-item__nome">' + i.nome + '</p>' +
            '<p class="ck-item__qtd">' + i.qtd + ' × ' + fmt(i.preco) + '</p>' +
          '</div>' +
          '<span class="ck-item__sub">' + fmt(i.subtotal) + '</span>' +
        '</li>';
    }).join('');

    totalEl.innerHTML = '' +
      '<div class="ck-totais__linha"><span>Subtotal</span><span>' + fmt(t.subtotal) + '</span></div>' +
      (t.desconto > 0
        ? '<div class="ck-totais__linha ck-totais__linha--off"><span>Desconto · ' + t.cupom + '</span>' +
          '<span>−' + fmt(t.desconto) + '</span></div>'
        : '') +
      '<div class="ck-totais__linha ck-totais__linha--soft"><span>Entrega</span><span>Digital · imediata</span></div>' +
      '<div class="ck-totais__total"><span>Total</span><strong>' + fmt(t.total) + '</strong></div>';

    $('#ck-total-btn').textContent = fmt(t.total);
  }

  /* ====================== 4. VALIDAÇÃO ====================== */
  function mascararTelefone(valor) {
    var d = String(valor).replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function erro(campo, texto) {
    var el = $('#ck-' + campo);
    var msg = $('#ck-' + campo + '-erro');
    if (el) el.classList.toggle('is-erro', !!texto);
    if (el) el.setAttribute('aria-invalid', texto ? 'true' : 'false');
    if (msg) msg.textContent = texto || '';
    return !texto;
  }

  function validar() {
    var nome = form.nome.value.trim();
    var email = form.email.value.trim();
    var tel = form.telefone.value.replace(/\D/g, '');
    var ok = true;

    ok = erro('nome', nome.length < 3 ? 'Escreva seu nome completo.' : '') && ok;
    ok = erro('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Confira o e-mail digitado.') && ok;
    ok = erro('tel', tel.length < 10 ? 'Telefone com DDD, ex.: (33) 99999-0000.' : '') && ok;

    return ok ? { nome: nome, email: email, telefone: form.telefone.value.trim(), telefoneNumeros: tel } : null;
  }

  function preencherSalvo() {
    try {
      var salvo = JSON.parse(window.localStorage.getItem(CHAVE_CLIENTE) || 'null');
      if (!salvo) return;
      if (salvo.nome) form.nome.value = salvo.nome;
      if (salvo.email) form.email.value = salvo.email;
      if (salvo.telefone) form.telefone.value = salvo.telefone;
    } catch (e) { /* sem dados salvos */ }
  }

  /* ====================== 5. PEDIDO ====================== */
  function novoId() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return 'SP' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) +
           '-' + String(Math.floor(Math.random() * 9000) + 1000);
  }

  function montarPedido(cliente) {
    var t = window.Carrinho.totais();
    return {
      id: novoId(),
      criadoEm: new Date().toISOString(),
      cliente: cliente,
      itens: window.Carrinho.itens(),
      totais: t,
      pagamento: {
        provedor: (CFG.pagamento && CFG.pagamento.provedor) || 'whatsapp',
        status: 'aguardando'
      }
    };
  }

  function guardarPedido(pedido) {
    try {
      window.localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido));
      window.localStorage.setItem(CHAVE_CLIENTE, JSON.stringify(pedido.cliente));
    } catch (e) { /* segue sem persistir */ }
  }

  /* ====================== 6. LOADER ====================== */
  function carregando(ligado, texto) {
    modal.classList.toggle('is-loading', !!ligado);
    botao.disabled = !!ligado;
    $('#ck-loading').hidden = !ligado;
    if (texto) $('#ck-loading-txt').textContent = texto;
  }

  /* ====================== 7. ENVIO ====================== */
  function enviar(ev) {
    ev.preventDefault();

    var cliente = validar();
    if (!cliente) {
      var primeiroErro = $('.is-erro', form);
      if (primeiroErro) primeiroErro.focus();
      return;
    }
    if (!window.Carrinho.totais().quantidade) return;

    var pedido = montarPedido(cliente);
    guardarPedido(pedido);

    var provedor = (CFG.pagamento && CFG.pagamento.provedor) || 'whatsapp';

    if (provedor === 'mercadopago') {
      carregando(true, 'Abrindo o pagamento seguro…');
      pagarComMercadoPago(pedido);
    } else {
      carregando(true, 'Confirmando seu pedido…');
      // pequena pausa só para o loader não piscar
      window.setTimeout(function () {
        window.location.href = CFG.paginas.sucesso + '?pedido=' + encodeURIComponent(pedido.id);
      }, reduzido ? 200 : 900);
    }
  }

  /* ====================== 8. MERCADO PAGO ======================
     O Access Token é secreto e nunca pode ficar no site. Por isso o site só
     conversa com o SEU servidor, que guarda o token e cria a preferência.
     O servidor de exemplo pronto para rodar está em mercadopago/server.js.
     ============================================================ */
  function pagarComMercadoPago(pedido) {
    var mp = (CFG.pagamento && CFG.pagamento.mercadoPago) || {};

    var corpo = {
      pedidoId: pedido.id,
      pagador: {
        nome: pedido.cliente.nome,
        email: pedido.cliente.email,
        telefone: pedido.cliente.telefoneNumeros
      },
      itens: pedido.itens.map(function (i) {
        return { id: i.id, titulo: i.nome, quantidade: i.qtd, precoUnitario: i.preco };
      }),
      desconto: pedido.totais.desconto,
      total: pedido.totais.total,
      retorno: {
        sucesso: mp.urlRetornoSucesso,
        pendente: mp.urlRetornoPendente,
        falha: mp.urlRetornoFalha
      }
    };

    window.fetch(mp.endpointCriarPreferencia, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (dados) {
        // O servidor devolve { init_point } (ou sandbox_init_point em teste).
        var destino = dados.init_point || dados.sandbox_init_point;
        if (!destino) throw new Error('resposta sem init_point');
        window.location.href = destino;
      })
      .catch(function (e) {
        console.error('[checkout] Mercado Pago indisponível:', e);
        carregando(false);
        // Sem pagamento online, o pedido não se perde: segue para o WhatsApp.
        avisarFalhaPagamento(pedido);
      });
  }

  function avisarFalhaPagamento(pedido) {
    if (window.Carrinho && window.Carrinho.aviso) {
      window.Carrinho.aviso('Pagamento online indisponível agora — vamos finalizar pelo WhatsApp.');
    }
    window.setTimeout(function () {
      window.location.href = CFG.paginas.sucesso + '?pedido=' + encodeURIComponent(pedido.id);
    }, 1200);
  }

  /* ====================== 9. EVENTOS ====================== */
  function ligarEventos() {
    overlay.addEventListener('click', function () {
      if (!modal.classList.contains('is-loading')) fechar();
    });
    $('#ck-close').addEventListener('click', fechar);
    form.addEventListener('submit', enviar);

    form.telefone.addEventListener('input', function () {
      var pos = this.selectionStart === this.value.length;
      this.value = mascararTelefone(this.value);
      if (pos) this.setSelectionRange(this.value.length, this.value.length);
    });

    // limpa o erro assim que a pessoa corrige
    ['nome', 'email', 'telefone'].forEach(function (nome) {
      form[nome].addEventListener('input', function () {
        if (this.classList.contains('is-erro')) {
          erro(nome === 'telefone' ? 'tel' : nome, '');
        }
      });
    });
  }

  /* ====================== 10. START ====================== */
  function iniciar() {
    montar();

    document.addEventListener('carrinho:finalizar', function () {
      if (window.Carrinho) window.Carrinho.fechar();
      window.setTimeout(abrir, reduzido ? 0 : 220);
    });

    // mantém o resumo do checkout em dia se o carrinho mudar por trás
    if (window.Carrinho) {
      window.Carrinho.aoMudar(function () {
        if (aberto) renderizarResumo();
      });
    }

    window.Checkout = { abrir: abrir, fechar: fechar };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

})(window, document);
