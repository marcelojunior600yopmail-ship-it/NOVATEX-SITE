/* ==========================================================================
   CARRINHO DE COMPRAS
   --------------------------------------------------------------------------
   Motor + interface do carrinho. Não tem nada de produto escrito aqui dentro:
   tudo vem do js/shop-config.js. Para colocar o carrinho em qualquer página,
   basta carregar shop-config.js, css/cart.css e este arquivo — o botão fixo,
   a sidebar e os avisos são criados sozinhos.

   Como um botão vira "Adicionar ao carrinho":
     <button data-add-cart="repertorio-atualizado">Adicionar ao carrinho</button>

   API pública (window.Carrinho):
     Carrinho.adicionar(id, qtd)   Carrinho.remover(id)
     Carrinho.definirQtd(id, qtd)  Carrinho.limpar()
     Carrinho.abrir()              Carrinho.fechar()
     Carrinho.itens()              Carrinho.totais()
     Carrinho.aplicarCupom(codigo) Carrinho.removerCupom()
     Carrinho.formatar(valor)      Carrinho.produto(id)
     Carrinho.aoMudar(callback)

   Estrutura interna:
     0. utilidades      1. estado e armazenamento    2. regras de preço
     3. montagem do HTML 4. renderização             5. abrir/fechar
     6. eventos          7. avisos (toast)           8. start
   ========================================================================== */
(function (window, document) {
  'use strict';

  var CFG = window.LOJA;
  if (!CFG) {
    console.error('[carrinho] js/shop-config.js precisa ser carregado antes de js/cart.js');
    return;
  }

  /* ====================== 0. UTILIDADES ====================== */
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var formatador = new Intl.NumberFormat(CFG.locale || 'pt-BR', {
    style: 'currency',
    currency: CFG.moeda || 'BRL'
  });

  function formatar(valor) {
    return formatador.format(Number(valor) || 0);
  }

  function escapar(txt) {
    return String(txt == null ? '' : txt)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function produto(id) {
    var lista = CFG.produtos || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  function maxDoProduto(p) {
    var padrao = (CFG.carrinho && CFG.carrinho.maxQtdPadrao) || 99;
    return Math.max(1, Number(p && p.maxQtd) || padrao);
  }

  /* ====================== 1. ESTADO E ARMAZENAMENTO ====================== */
  var CHAVE = (CFG.carrinho && CFG.carrinho.chaveArmazenamento) || 'loja:carrinho';

  // { itens: [{ id, qtd }], cupom: 'CODIGO' | null }
  var estado = { itens: [], cupom: null };
  var ouvintes = [];

  function ler() {
    try {
      var bruto = window.localStorage.getItem(CHAVE);
      if (!bruto) return;
      var dados = JSON.parse(bruto);
      if (!dados || !Array.isArray(dados.itens)) return;

      // Ignora itens de produtos que não existem mais na configuração.
      estado.itens = dados.itens
        .filter(function (i) { return i && produto(i.id); })
        .map(function (i) {
          var p = produto(i.id);
          return { id: i.id, qtd: Math.min(maxDoProduto(p), Math.max(1, parseInt(i.qtd, 10) || 1)) };
        });

      estado.cupom = cupomValido(dados.cupom) ? String(dados.cupom).toUpperCase() : null;
    } catch (e) {
      estado = { itens: [], cupom: null };
    }
  }

  function salvar() {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) { /* modo anônimo / armazenamento cheio: segue sem persistir */ }
  }

  function itemDe(id) {
    for (var i = 0; i < estado.itens.length; i++) {
      if (estado.itens[i].id === id) return estado.itens[i];
    }
    return null;
  }

  function mudou() {
    salvar();
    renderizar();
    for (var i = 0; i < ouvintes.length; i++) {
      try { ouvintes[i](totais(), itens()); } catch (e) { /* ouvinte quebrado não derruba o carrinho */ }
    }
    document.dispatchEvent(new CustomEvent('carrinho:mudou', {
      detail: { itens: itens(), totais: totais() }
    }));
  }

  /* ====================== 2. REGRAS DE PREÇO ====================== */
  function itens() {
    return estado.itens.map(function (i) {
      var p = produto(i.id) || {};
      return {
        id: i.id,
        qtd: i.qtd,
        nome: p.nome,
        preco: p.preco,
        imagem: p.imagem,
        entrega: p.entrega,
        subtotal: (Number(p.preco) || 0) * i.qtd
      };
    });
  }

  function cupomValido(codigo) {
    if (!codigo) return null;
    var alvo = String(codigo).trim().toUpperCase();
    var lista = CFG.cupons || [];
    for (var i = 0; i < lista.length; i++) {
      if (String(lista[i].codigo).toUpperCase() === alvo) return lista[i];
    }
    return null;
  }

  function totais() {
    var subtotal = itens().reduce(function (soma, i) { return soma + i.subtotal; }, 0);
    var quantidade = estado.itens.reduce(function (soma, i) { return soma + i.qtd; }, 0);

    var desconto = 0;
    var cupom = cupomValido(estado.cupom);
    if (cupom && subtotal >= (Number(cupom.minimo) || 0)) {
      desconto = cupom.tipo === 'percentual'
        ? subtotal * (Number(cupom.valor) || 0) / 100
        : (Number(cupom.valor) || 0);
      desconto = Math.min(desconto, subtotal);
    } else {
      cupom = null;
    }

    // Arredonda em centavos para o total nunca ficar com dízima.
    desconto = Math.round(desconto * 100) / 100;
    var total = Math.round((subtotal - desconto) * 100) / 100;

    return {
      quantidade: quantidade,
      subtotal: subtotal,
      desconto: desconto,
      total: total,
      cupom: cupom ? cupom.codigo : null,
      cupomRotulo: cupom ? (cupom.rotulo || cupom.codigo) : null
    };
  }

  /* ====================== 3. MONTAGEM DO HTML ====================== */
  var raiz, fab, contador, overlay, gaveta, lista, vazio, resumo, botaoFinalizar, avisos;
  var cupomInput, cupomMsg, cupomAplicado;
  var ultimoFoco = null;

  var ICONE_CARRINHO =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3 4h2.2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6.2"/>' +
    '<circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>';

  var ICONE_X =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function montar() {
    raiz = document.createElement('div');
    raiz.className = 'cart-root';
    raiz.innerHTML =
      '<button class="cart-fab" type="button" id="cart-fab" aria-expanded="false" aria-controls="cart-drawer">' +
        '<span class="cart-fab__ico">' + ICONE_CARRINHO + '</span>' +
        '<span class="cart-fab__count" id="cart-count" aria-hidden="true">0</span>' +
        '<span class="sr-only" id="cart-fab-label">Abrir carrinho</span>' +
      '</button>' +

      '<div class="cart-overlay" id="cart-overlay" hidden></div>' +

      '<aside class="cart-drawer" id="cart-drawer" role="dialog" aria-modal="true"' +
      ' aria-labelledby="cart-title" hidden>' +
        '<header class="cart-drawer__head">' +
          '<h2 class="cart-drawer__title" id="cart-title">Seu carrinho</h2>' +
          '<button class="cart-drawer__close" type="button" id="cart-close" aria-label="Fechar carrinho">' +
            ICONE_X +
          '</button>' +
        '</header>' +

        '<div class="cart-drawer__body">' +
          '<ul class="cart-items" id="cart-items"></ul>' +

          '<div class="cart-empty" id="cart-empty" hidden>' +
            '<span class="cart-empty__ico">' + ICONE_CARRINHO + '</span>' +
            '<p class="cart-empty__title">Seu carrinho está vazio</p>' +
            '<p class="cart-empty__txt">Adicione o repertório e finalize em menos de um minuto.</p>' +
            '<button class="btn btn--ghost-neon" type="button" id="cart-continuar">Ver o produto</button>' +
          '</div>' +
        '</div>' +

        '<div class="cart-drawer__foot" id="cart-foot">' +
          '<form class="cart-coupon" id="cart-coupon" novalidate>' +
            '<label class="cart-coupon__label" for="cart-coupon-input">Cupom de desconto</label>' +
            '<div class="cart-coupon__row">' +
              '<input class="cart-coupon__input" id="cart-coupon-input" type="text"' +
              ' placeholder="Digite o cupom" autocomplete="off" spellcheck="false"' +
              ' aria-describedby="cart-coupon-msg">' +
              '<button class="cart-coupon__btn" type="submit">Aplicar</button>' +
            '</div>' +
            '<p class="cart-coupon__msg" id="cart-coupon-msg" role="status"></p>' +
          '</form>' +

          '<div class="cart-summary" id="cart-summary"></div>' +

          '<button class="btn btn--neon btn--block cart-checkout" type="button" id="cart-checkout">' +
            'Finalizar compra' +
          '</button>' +

          '<p class="cart-drawer__note">Pagamento combinado direto no WhatsApp. O link de download é enviado após a confirmação.</p>' +
        '</div>' +
      '</aside>' +

      '<div class="cart-toasts" id="cart-toasts" role="status" aria-live="polite"></div>';

    document.body.appendChild(raiz);

    fab            = $('#cart-fab', raiz);
    contador       = $('#cart-count', raiz);
    overlay        = $('#cart-overlay', raiz);
    gaveta         = $('#cart-drawer', raiz);
    lista          = $('#cart-items', raiz);
    vazio          = $('#cart-empty', raiz);
    resumo         = $('#cart-summary', raiz);
    botaoFinalizar = $('#cart-checkout', raiz);
    avisos         = $('#cart-toasts', raiz);
    cupomInput     = $('#cart-coupon-input', raiz);
    cupomMsg       = $('#cart-coupon-msg', raiz);

    // Sem cupons configurados, o campo simplesmente não aparece.
    if (!(CFG.cupons && CFG.cupons.length)) {
      var form = $('#cart-coupon', raiz);
      if (form) form.hidden = true;
    }
  }

  /* ====================== 4. RENDERIZAÇÃO ====================== */
  function renderizar() {
    var t = totais();
    var linhas = itens();

    /* botão fixo */
    contador.textContent = t.quantidade > 99 ? '99+' : String(t.quantidade);
    fab.classList.toggle('is-empty', t.quantidade === 0);
    fab.setAttribute('aria-label',
      t.quantidade === 0
        ? 'Abrir carrinho — vazio'
        : 'Abrir carrinho — ' + t.quantidade + (t.quantidade === 1 ? ' item' : ' itens'));

    /* itens */
    lista.innerHTML = linhas.map(function (i) {
      var p = produto(i.id) || {};
      var max = maxDoProduto(p);
      return '' +
        '<li class="cart-item" data-item="' + escapar(i.id) + '">' +
          '<div class="cart-item__thumb">' +
            '<img src="' + escapar(i.imagem) + '" alt="" width="120" height="120" loading="lazy" decoding="async">' +
          '</div>' +
          '<div class="cart-item__info">' +
            '<h3 class="cart-item__name">' + escapar(i.nome) + '</h3>' +
            (i.entrega ? '<p class="cart-item__meta">' + escapar(i.entrega) + '</p>' : '') +
            '<p class="cart-item__unit">' + formatar(i.preco) + ' <span>/ un.</span></p>' +
            '<div class="cart-item__row">' +
              '<div class="qty" role="group" aria-label="Quantidade de ' + escapar(i.nome) + '">' +
                '<button class="qty__btn" type="button" data-qty="-1" data-id="' + escapar(i.id) + '"' +
                  (i.qtd <= 1 ? ' disabled' : '') + ' aria-label="Diminuir quantidade">−</button>' +
                '<input class="qty__input" type="text" inputmode="numeric" value="' + i.qtd + '"' +
                  ' data-qty-input="' + escapar(i.id) + '" aria-label="Quantidade">' +
                '<button class="qty__btn" type="button" data-qty="1" data-id="' + escapar(i.id) + '"' +
                  (i.qtd >= max ? ' disabled' : '') + ' aria-label="Aumentar quantidade">+</button>' +
              '</div>' +
              '<span class="cart-item__sub">' + formatar(i.subtotal) + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="cart-item__del" type="button" data-remove="' + escapar(i.id) + '"' +
          ' aria-label="Remover ' + escapar(i.nome) + ' do carrinho">' + ICONE_X + '</button>' +
        '</li>';
    }).join('');

    var temItens = linhas.length > 0;
    lista.hidden = !temItens;
    vazio.hidden = temItens;
    $('#cart-foot', raiz).hidden = !temItens;

    /* resumo do pedido */
    resumo.innerHTML = '' +
      '<h3 class="cart-summary__title">Resumo do pedido</h3>' +
      '<div class="cart-summary__line">' +
        '<span>Subtotal (' + t.quantidade + (t.quantidade === 1 ? ' item' : ' itens') + ')</span>' +
        '<span>' + formatar(t.subtotal) + '</span>' +
      '</div>' +
      (t.desconto > 0
        ? '<div class="cart-summary__line cart-summary__line--off">' +
            '<span>Desconto · ' + escapar(t.cupom) + '</span>' +
            '<span>−' + formatar(t.desconto) + '</span>' +
          '</div>'
        : '') +
      '<div class="cart-summary__line cart-summary__line--soft">' +
        '<span>Entrega</span><span>Digital · imediata</span>' +
      '</div>' +
      '<div class="cart-summary__total">' +
        '<span>Total</span><strong>' + formatar(t.total) + '</strong>' +
      '</div>';

    /* estado do cupom */
    cupomAplicado = t.cupom;
    if (cupomInput) {
      if (t.cupom) {
        cupomInput.value = t.cupom;
        mensagemCupom('Cupom ' + t.cupom + ' aplicado — ' + t.cupomRotulo + '.', 'ok');
      } else if (!cupomInput.value) {
        mensagemCupom('', '');
      }
    }

    /* espelha a quantidade nos botões da página ("2 no carrinho") */
    $$('[data-cart-count-for]').forEach(function (el) {
      var item = itemDe(el.getAttribute('data-cart-count-for'));
      el.textContent = item ? String(item.qtd) : '0';
      el.hidden = !item;
    });
  }

  function mensagemCupom(texto, tipo) {
    if (!cupomMsg) return;
    cupomMsg.textContent = texto;
    cupomMsg.className = 'cart-coupon__msg' + (tipo ? ' is-' + tipo : '');
  }

  /* ====================== 5. ABRIR / FECHAR ====================== */
  var aberto = false;

  function abrir() {
    if (aberto) return;
    aberto = true;
    ultimoFoco = document.activeElement;

    overlay.hidden = false;
    gaveta.hidden = false;
    // força o reflow para a transição de entrada acontecer
    void gaveta.offsetWidth;

    document.body.classList.add('cart-open');
    overlay.classList.add('is-on');
    gaveta.classList.add('is-on');
    fab.setAttribute('aria-expanded', 'true');

    var focavel = gaveta.querySelector('#cart-close');
    if (focavel) focavel.focus();

    document.addEventListener('keydown', teclado);
  }

  function fechar() {
    if (!aberto) return;
    aberto = false;

    overlay.classList.remove('is-on');
    gaveta.classList.remove('is-on');
    document.body.classList.remove('cart-open');
    fab.setAttribute('aria-expanded', 'false');

    document.removeEventListener('keydown', teclado);

    window.setTimeout(function () {
      if (aberto) return;
      overlay.hidden = true;
      gaveta.hidden = true;
    }, reduzido ? 0 : 320);

    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function teclado(ev) {
    if (ev.key === 'Escape') { fechar(); return; }
    if (ev.key !== 'Tab') return;

    // prende o foco dentro da gaveta enquanto ela está aberta
    var focaveis = $$('button, [href], input, select, textarea', gaveta)
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!focaveis.length) return;

    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];

    if (ev.shiftKey && document.activeElement === primeiro) {
      ev.preventDefault(); ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault(); primeiro.focus();
    }
  }

  /* ====================== 6. AÇÕES ====================== */
  function adicionar(id, qtd) {
    var p = produto(id);
    if (!p) { console.warn('[carrinho] produto não encontrado:', id); return; }

    qtd = Math.max(1, parseInt(qtd, 10) || 1);
    var item = itemDe(id);
    var max = maxDoProduto(p);

    if (item) {
      item.qtd = Math.min(max, item.qtd + qtd);
    } else {
      estado.itens.push({ id: id, qtd: Math.min(max, qtd) });
    }

    mudou();
    pulsar();
    aviso('<strong>' + escapar(p.nome) + '</strong> adicionado ao carrinho');
    return item || itemDe(id);
  }

  function definirQtd(id, qtd) {
    var item = itemDe(id);
    if (!item) return;

    qtd = parseInt(qtd, 10);
    if (isNaN(qtd) || qtd <= 0) { remover(id); return; }

    item.qtd = Math.min(maxDoProduto(produto(id)), qtd);
    mudou();
  }

  function remover(id) {
    var p = produto(id);
    estado.itens = estado.itens.filter(function (i) { return i.id !== id; });
    mudou();
    if (p) aviso('<strong>' + escapar(p.nome) + '</strong> removido do carrinho');
  }

  function limpar() {
    estado.itens = [];
    estado.cupom = null;
    if (cupomInput) cupomInput.value = '';
    mudou();
  }

  function aplicarCupom(codigo) {
    var alvo = String(codigo || '').trim().toUpperCase();
    if (!alvo) { mensagemCupom('Digite um cupom.', 'erro'); return false; }

    var cupom = cupomValido(alvo);
    if (!cupom) { mensagemCupom('Cupom inválido ou expirado.', 'erro'); return false; }

    var sub = totais().subtotal;
    if (sub < (Number(cupom.minimo) || 0)) {
      mensagemCupom('Este cupom vale a partir de ' + formatar(cupom.minimo) + '.', 'erro');
      return false;
    }

    estado.cupom = cupom.codigo.toUpperCase();
    mudou();
    return true;
  }

  function removerCupom() {
    estado.cupom = null;
    if (cupomInput) cupomInput.value = '';
    mudou();
    mensagemCupom('Cupom removido.', '');
  }

  function pulsar() {
    fab.classList.remove('is-bump');
    void fab.offsetWidth;
    fab.classList.add('is-bump');
  }

  /* ====================== 7. AVISOS (TOAST) ====================== */
  function aviso(html) {
    if (!avisos) return;

    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML =
      '<span class="toast__ico" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' +
      '</span>' +
      '<span class="toast__txt">' + html + '</span>' +
      '<button class="toast__cta" type="button" data-open-cart>Ver carrinho</button>';

    avisos.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-on');

    window.setTimeout(function () {
      el.classList.remove('is-on');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
    }, 3600);
  }

  /* ====================== 8. EVENTOS ====================== */
  function ligarEventos() {
    fab.addEventListener('click', abrir);
    overlay.addEventListener('click', fechar);
    $('#cart-close', raiz).addEventListener('click', fechar);

    var continuar = $('#cart-continuar', raiz);
    if (continuar) continuar.addEventListener('click', function () {
      fechar();
      var alvo = $('#produto');
      if (alvo) alvo.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'start' });
    });

    /* cliques dentro da gaveta e na página inteira */
    document.addEventListener('click', function (ev) {
      var alvo = ev.target.closest ? ev.target : ev.target.parentNode;
      if (!alvo || !alvo.closest) return;

      var add = alvo.closest('[data-add-cart]');
      if (add) {
        ev.preventDefault();
        var qtdCampo = add.getAttribute('data-qty-from');
        var qtd = 1;
        if (qtdCampo) {
          var campo = document.getElementById(qtdCampo);
          if (campo) qtd = parseInt(campo.value, 10) || 1;
        }
        adicionar(add.getAttribute('data-add-cart'), qtd);
        if (add.hasAttribute('data-open-after')) abrir();
        return;
      }

      var abre = alvo.closest('[data-open-cart]');
      if (abre) { ev.preventDefault(); abrir(); return; }

      var mais = alvo.closest('[data-qty]');
      if (mais) {
        var id = mais.getAttribute('data-id');
        var item = itemDe(id);
        if (item) definirQtd(id, item.qtd + parseInt(mais.getAttribute('data-qty'), 10));
        return;
      }

      var del = alvo.closest('[data-remove]');
      if (del) { remover(del.getAttribute('data-remove')); return; }
    });

    /* digitação direta na quantidade */
    lista.addEventListener('change', function (ev) {
      var campo = ev.target.closest && ev.target.closest('[data-qty-input]');
      if (!campo) return;
      definirQtd(campo.getAttribute('data-qty-input'), campo.value);
    });
    lista.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var campo = ev.target.closest && ev.target.closest('[data-qty-input]');
      if (!campo) return;
      ev.preventDefault();
      definirQtd(campo.getAttribute('data-qty-input'), campo.value);
    });

    /* cupom */
    var formCupom = $('#cart-coupon', raiz);
    if (formCupom) {
      formCupom.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (cupomAplicado && cupomInput.value.trim().toUpperCase() === cupomAplicado) {
          removerCupom();
        } else {
          aplicarCupom(cupomInput.value);
        }
      });
    }

    /* finalizar compra — quem responde é o js/checkout.js */
    botaoFinalizar.addEventListener('click', function () {
      if (!estado.itens.length) return;
      document.dispatchEvent(new CustomEvent('carrinho:finalizar', {
        detail: { itens: itens(), totais: totais() }
      }));
    });

    /* carrinho aberto em outra aba do navegador */
    window.addEventListener('storage', function (ev) {
      if (ev.key !== CHAVE) return;
      ler();
      renderizar();
    });
  }

  /* ====================== 9. START ====================== */
  function iniciar() {
    montar();
    ler();
    ligarEventos();
    renderizar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  window.Carrinho = {
    adicionar: adicionar,
    definirQtd: definirQtd,
    remover: remover,
    limpar: limpar,
    abrir: abrir,
    fechar: fechar,
    itens: itens,
    totais: totais,
    aplicarCupom: aplicarCupom,
    removerCupom: removerCupom,
    formatar: formatar,
    produto: produto,
    aviso: aviso,
    aoMudar: function (fn) { if (typeof fn === 'function') ouvintes.push(fn); }
  };

})(window, document);
