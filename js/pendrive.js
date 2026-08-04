/* ==========================================================================
   SEU PENDRIVE ATUALIZADO — interatividade da página
   1. preços vindos da configuração   2. links de WhatsApp
   3. nav sticky + link ativo         4. reveals no scroll
   5. stepper de quantidade           6. lightbox da foto
   ========================================================================== */
(function (window, document) {
  'use strict';

  var CFG = window.LOJA || {};
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ====================== 1. PREÇOS ======================
     A página nasce com o preço escrito no HTML (para quem abre sem JS),
     mas quem manda é o js/shop-config.js. */
  function aplicarPrecos() {
    if (!window.Carrinho) return;

    $$('[data-preco]').forEach(function (el) {
      var p = window.Carrinho.produto(el.getAttribute('data-preco'));
      if (p) el.textContent = window.Carrinho.formatar(p.preco);
    });

    $$('[data-preco-de]').forEach(function (el) {
      var p = window.Carrinho.produto(el.getAttribute('data-preco-de'));
      if (p) el.textContent = window.Carrinho.formatar(p.preco);
    });

    $$('[data-preco-antigo]').forEach(function (el) {
      var p = window.Carrinho.produto(el.getAttribute('data-preco-antigo'));
      if (p && p.precoDe) {
        el.textContent = window.Carrinho.formatar(p.precoDe);
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    });
  }

  /* ====================== 2. WHATSAPP ======================
     Todo link com data-wa-link é montado a partir do número da configuração,
     então trocar o WhatsApp da loja é mexer em um lugar só. */
  function aplicarWhatsApp() {
    var wa = CFG.whatsapp || {};
    if (!wa.numero) return;

    $$('[data-wa-link]').forEach(function (el) {
      var texto = el.getAttribute('data-wa-texto') || 'Olá!';
      el.href = 'https://wa.me/' + wa.numero + '?text=' + encodeURIComponent(texto);
      el.target = '_blank';
      el.rel = 'noopener';
    });

    if (wa.exibicao) {
      $$('[data-wa-exibicao]').forEach(function (el) { el.textContent = wa.exibicao; });
    }
  }

  /* ====================== 3. NAV ====================== */
  function nav() {
    var barra = $('#nav');
    if (!barra) return;

    var marcar = function () {
      barra.classList.toggle('is-stuck', window.scrollY > 12);
    };
    marcar();
    window.addEventListener('scroll', marcar, { passive: true });

    var links = $$('.nav__links a');
    var secoes = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if (!('IntersectionObserver' in window) || !secoes.length) return;

    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    secoes.forEach(function (s) { obs.observe(s); });
  }

  /* ====================== 4. REVEALS ====================== */
  function reveals() {
    var alvos = $$('.reveal');
    if (!alvos.length) return;

    if (reduzido || !('IntersectionObserver' in window)) {
      alvos.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    alvos.forEach(function (el) { obs.observe(el); });
  }

  /* ====================== 5. STEPPER ====================== */
  function stepper() {
    $$('.stepper').forEach(function (grupo) {
      var campo = $('input', grupo);
      if (!campo) return;

      var limite = 99;
      var botaoAdd = $('[data-qty-from="' + campo.id + '"]');
      if (botaoAdd && window.Carrinho) {
        var p = window.Carrinho.produto(botaoAdd.getAttribute('data-add-cart'));
        if (p && p.maxQtd) limite = p.maxQtd;
      }

      var ajustar = function (valor) {
        var n = parseInt(valor, 10);
        if (isNaN(n) || n < 1) n = 1;
        campo.value = Math.min(limite, n);
      };

      $$('[data-step]', grupo).forEach(function (btn) {
        btn.addEventListener('click', function () {
          ajustar((parseInt(campo.value, 10) || 1) + parseInt(btn.getAttribute('data-step'), 10));
        });
      });

      campo.addEventListener('change', function () { ajustar(campo.value); });
      campo.addEventListener('blur', function () { ajustar(campo.value); });
    });

    // depois de adicionar, a quantidade volta para 1
    document.addEventListener('carrinho:mudou', function () {
      var campo = $('#qtd-produto');
      if (campo) campo.value = '1';
    });
  }

  /* ====================== 6. LIGHTBOX ====================== */
  function lightbox() {
    var caixa = $('#lightbox');
    var img = $('#lb-img');
    if (!caixa || !img) return;

    var ultimoFoco = null;

    function abrir(origem) {
      ultimoFoco = document.activeElement;
      img.src = origem.src;
      img.alt = origem.alt || '';
      caixa.hidden = false;
      void caixa.offsetWidth;
      caixa.classList.add('is-on');
      document.body.style.overflow = 'hidden';
      $('.lightbox__close', caixa).focus();
      document.addEventListener('keydown', esc);
    }

    function fechar() {
      caixa.classList.remove('is-on');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', esc);
      window.setTimeout(function () { caixa.hidden = true; }, reduzido ? 0 : 300);
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    function esc(ev) { if (ev.key === 'Escape') fechar(); }

    $$('[data-zoom]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var foto = $('img', botao.parentNode);
        if (foto) abrir(foto);
      });
    });

    $('.lightbox__close', caixa).addEventListener('click', fechar);
    caixa.addEventListener('click', function (ev) {
      if (ev.target === caixa) fechar();
    });
  }

  /* ====================== START ====================== */
  function iniciar() {
    aplicarPrecos();
    aplicarWhatsApp();
    nav();
    reveals();
    stepper();
    lightbox();

    var ano = $('#ano');
    if (ano) ano.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

})(window, document);
