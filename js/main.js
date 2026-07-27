/* ==========================================================================
   NOVATEX — interatividade
   0. abertura com a logo
   1. nav (sticky, menu mobile, link ativo)
   2. carrossel de novidades do hero
   3. reveals no scroll
   4. FAQ acordeão
   5. lightbox das fotos
   6. CTA flutuante do WhatsApp

   A abertura dispara o evento 'novatex:ready' ao sair. Os reveals e o
   autoplay do carrossel esperam por ele, para a animação do hero não rodar
   escondida atrás do overlay.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ====================== 0. ABERTURA ====================== */
  var intro = $('#intro');
  var introDone = false;

  function finishIntro() {
    if (introDone) return;
    introDone = true;

    if (intro) intro.classList.add('is-done');
    document.body.style.overflow = '';

    startReveals();
    document.dispatchEvent(new CustomEvent('novatex:ready'));

    // tira o overlay do caminho depois do fade
    window.setTimeout(function () {
      if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    }, reduced ? 20 : 800);
  }

  if (intro) {
    document.body.style.overflow = 'hidden';

    var HOLD = reduced ? 120 : 1500;   // tempo de tela depois de tudo carregado
    // trava de segurança: se alguma imagem travar, o 'load' não vem
    var failsafe = window.setTimeout(finishIntro, reduced ? 200 : 3000);

    if (document.readyState === 'complete') {
      window.setTimeout(finishIntro, HOLD);
    } else {
      window.addEventListener('load', function () {
        window.clearTimeout(failsafe);
        window.setTimeout(finishIntro, HOLD);
      });
    }

    // quem já viu a abertura e clicou/apertou algo não precisa esperar
    intro.addEventListener('click', finishIntro);
    document.addEventListener('keydown', function (e) {
      if (!introDone && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) finishIntro();
    });
  }

  /* ====================== 1. NAV ====================== */
  var nav = $('#nav');
  var burger = $('#burger');
  var menu = $('#menu-mobile');
  var waFloat = $('.wa-float');

  function onScroll() {
    var y = window.scrollY;
    if (nav) nav.classList.toggle('is-stuck', y > 12);
    if (waFloat) waFloat.classList.toggle('is-visible', y > 520);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
    menu.hidden = true;
  }

  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      if (open) { closeMenu(); return; }
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Fechar menu');
      menu.hidden = false;
    });

    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeMenu();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menu && !menu.hidden) { closeMenu(); burger.focus(); }
    closeLightbox();
  });

  // marca no menu a seção que está na tela
  var navLinks = $$('.nav__links a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var sections = navLinks
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ====================== 2. CARROSSEL ====================== */
  (function initCarousel() {
    var root = $('#carousel');
    if (!root) return;

    var slides = $$('.cslide', root);
    if (slides.length < 2) return;

    var bar = $('#c-bar');
    var idxEl = $('#c-index');
    var totalEl = $('#c-total');
    var dotsWrap = $('#c-dots');
    var live = $('#c-live');
    var DUR = 5200;

    var i = 0, timer = null, paused = false, ready = false;

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    // pontinhos: um por slide, com o nome da peça no rótulo
    var dots = slides.map(function (slide, n) {
      var label = $('.cslide__cap strong', slide);
      var b = document.createElement('button');
      b.className = 'carousel__dot';
      b.type = 'button';
      b.setAttribute('aria-label', 'Ver ' + (label ? label.textContent.trim() : 'peça ' + (n + 1)));
      b.addEventListener('click', function () { go(n, true); });
      if (dotsWrap) dotsWrap.appendChild(b);
      return b;
    });

    function runBar() {
      if (!bar) return;
      bar.style.transition = 'none';
      bar.style.width = '0%';
      if (reduced) return;
      // força o reflow para a transição partir do zero
      void bar.offsetWidth;
      bar.style.transition = 'width ' + DUR + 'ms linear';
      bar.style.width = '100%';
    }

    function freezeBar() {
      if (!bar) return;
      var w = window.getComputedStyle(bar).width;
      bar.style.transition = 'none';
      bar.style.width = w;
    }

    function schedule() {
      clearTimeout(timer);
      if (reduced || paused || !ready) return;   // espera a abertura sair
      runBar();
      timer = setTimeout(function () { go(i + 1, false); }, DUR);
    }

    document.addEventListener('novatex:ready', function () {
      ready = true;
      schedule();
    });

    function go(n, byUser) {
      i = (n + slides.length) % slides.length;

      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) {
        if (k === i) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });

      if (idxEl) idxEl.textContent = pad(i + 1);
      if (live) {
        var cap = $('.cslide__cap strong', slides[i]);
        live.textContent = 'Peça ' + (i + 1) + ' de ' + slides.length +
                           (cap ? ': ' + cap.textContent.trim() : '');
      }

      if (byUser) { paused = true; clearTimeout(timer); freezeBar(); }
      else schedule();
    }

    if (totalEl) totalEl.textContent = pad(slides.length);

    var prev = $('#c-prev'), next = $('#c-next');
    if (prev) prev.addEventListener('click', function () { go(i - 1, true); });
    if (next) next.addEventListener('click', function () { go(i + 1, true); });

    // pausa enquanto o mouse está em cima ou o foco está dentro
    root.addEventListener('pointerenter', function () { paused = true; clearTimeout(timer); freezeBar(); });
    root.addEventListener('pointerleave', function () { paused = false; schedule(); });
    root.addEventListener('focusin', function () { paused = true; clearTimeout(timer); freezeBar(); });
    root.addEventListener('focusout', function () {
      if (!root.contains(document.activeElement)) { paused = false; schedule(); }
    });

    // não gasta bateria em aba escondida
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearTimeout(timer); freezeBar(); }
      else if (!paused) schedule();
    });

    // arrastar no touch
    var frame = $('.carousel__frame', root);
    var startX = null;
    frame.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    frame.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 42) go(i + (dx < 0 ? 1 : -1), true);
    });

    // setas do teclado quando o foco está no carrossel
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
    });

    go(0, false);
  })();

  /* ====================== 3. REVEALS ====================== */
  var revealables = $$('.reveal');
  revealables.forEach(function (el) {
    var d = el.getAttribute('data-reveal-delay');
    if (d) el.style.setProperty('--d', d);
  });

  // só começa quando a abertura sai (ver seção 0)
  function startReveals() {
    if (reduced || !('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('is-static'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ====================== 4. FAQ ====================== */
  var qas = $$('.qa');
  qas.forEach(function (qa) {
    qa.addEventListener('toggle', function () {
      if (!qa.open) return;
      qas.forEach(function (other) { if (other !== qa) other.open = false; });
    });
  });

  /* ====================== 5. LIGHTBOX ====================== */
  var lb = $('#lightbox');
  var lbImg = $('#lb-img');
  var lbCap = $('#lb-cap');
  var lastFocus = null;

  function openLightbox(img, caption) {
    if (!lb) return;
    lastFocus = document.activeElement;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    lbCap.textContent = caption || img.alt || '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    $('.lightbox__close', lb).focus();
  }

  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () {
      lb.hidden = true;
      lbImg.removeAttribute('src');
    }, reduced ? 0 : 240);
    if (lastFocus) lastFocus.focus();
  }

  if (lb) {
    $$('[data-zoom]').forEach(function (holder) {
      holder.addEventListener('click', function () {
        var img = $('img', holder);
        if (img) openLightbox(img, holder.getAttribute('data-zoom'));
      });
      holder.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        var img = $('img', holder);
        if (img) openLightbox(img, holder.getAttribute('data-zoom'));
      });
    });

    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.closest('.lightbox__close')) closeLightbox();
    });
  }

  /* ====================== 6. RODAPÉ ====================== */
  var ano = $('#ano');
  if (ano) ano.textContent = String(new Date().getFullYear());

  /* sem abertura (JS presente mas o overlay não existe): libera tudo agora.
     Fica no fim do arquivo porque os listeners de 'novatex:ready' precisam
     estar registrados antes do disparo. */
  if (!intro) finishIntro();
})();
