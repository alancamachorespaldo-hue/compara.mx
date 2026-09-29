/**
 * comparalo.mx — onboarding modal
 * Muestra el tutorial de 5 pasos solo en la primera sesión del navegador.
 * Se marca como visto si el usuario cierra el modal, hace clic en "Empezar"
 * o cambia de pestaña (visibilitychange).
 * Usa sessionStorage → dura hasta que se cierra el navegador/tab.
 */
(function () {
  'use strict';

  var KEY = 'cmx_onboarding_v1';

  // Ya visto esta sesión → no hacer nada
  if (sessionStorage.getItem(KEY)) return;

  var steps = [
    {
      img: '/fotos/pasos/paso-1.jpg',
      alt: 'comparalo.mx compara precios en Amazon MX y Mercado Libre México',
      title: 'Comparamos en Amazon y Mercado Libre',
      desc: 'Buscamos el mismo producto en Amazon MX y Mercado Libre para que decidas con precio, calidad y características reales.'
    },
    {
      img: '/fotos/pasos/paso-2.jpg',
      alt: 'Explora el catálogo de productos de la categoría',
      title: 'Explora el catálogo',
      desc: 'Ve todos los productos de la categoría con sus especificaciones reales: porciones, peso, tipo y precio.'
    },
    {
      img: '/fotos/pasos/paso-3.jpg',
      alt: 'Filtra y selecciona los productos que te interesan',
      title: 'Filtra y selecciona',
      desc: 'Usa los filtros para afinar por tipo, precio o plataforma. Selecciona hasta 3 productos para compararlos.'
    },
    {
      img: '/fotos/pasos/paso-4.jpg',
      alt: 'Compara productos lado a lado en una sola tabla',
      title: 'Compara lado a lado',
      desc: 'Ve en una sola tabla las diferencias reales: precio por porción, valoraciones, pesos y más. Sin ir a cada tienda.'
    },
    {
      img: '/fotos/pasos/paso-5.jpg',
      alt: 'Compra en Amazon o Mercado Libre donde te convenga más',
      title: 'Compra donde te convenga',
      desc: 'Haz clic en "Ir a producto" para abrir el artículo directamente en Amazon MX o Mercado Libre y comprarlo al mejor precio.'
    }
  ];

  var current = 0;

  function markSeen() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }

  function close() {
    markSeen();
    var el = document.getElementById('cmx-ob');
    if (el) {
      el.setAttribute('aria-hidden', 'true');
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') close();
  }

  function render() {
    var s = steps[current];
    var modal = document.getElementById('cmx-ob');
    if (!modal) return;

    // Imagen
    var img = modal.querySelector('.cmx-ob-img');
    img.src = s.img;
    img.alt = s.alt;

    // Texto
    modal.querySelector('.cmx-ob-step-title').textContent = s.title;
    modal.querySelector('.cmx-ob-step-desc').textContent = s.desc;

    // Dots
    var dots = modal.querySelectorAll('.cmx-ob-dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('on', i === current);
      dots[i].setAttribute('aria-current', i === current ? 'step' : 'false');
    }

    // Botones
    modal.querySelector('.cmx-ob-prev').disabled = current === 0;
    var nextBtn = modal.querySelector('.cmx-ob-next');
    var finBtn = modal.querySelector('.cmx-ob-fin');
    if (current === steps.length - 1) {
      nextBtn.style.display = 'none';
      finBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      finBtn.style.display = 'none';
    }

    // Contador
    modal.querySelector('.cmx-ob-count').textContent = (current + 1) + ' / ' + steps.length;
  }

  function build() {
    var css = [
      '#cmx-ob{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
      'background:rgba(15,23,42,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      'padding:16px;transition:opacity .35s;opacity:0}',
      '#cmx-ob.vis{opacity:1}',
      '.cmx-ob-box{background:#fff;border-radius:18px;width:100%;max-width:min(860px,94vw);overflow:hidden;',
      'box-shadow:0 24px 60px rgba(15,23,42,.22);display:flex;flex-direction:column}',
      '.cmx-ob-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0}',
      '.cmx-ob-logo{font-size:15px;font-weight:800;letter-spacing:-.03em;color:#0F172A;text-decoration:none}',
      '.cmx-ob-logo em{color:#006847;font-style:normal}',
      '.cmx-ob-x{width:34px;height:34px;border-radius:50%;border:1.5px solid #E2E8E4;background:#fff;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;color:#64748B;',
      'line-height:1;transition:border-color .15s,color .15s}',
      '.cmx-ob-x:hover{border-color:#006847;color:#006847}',
      '.cmx-ob-img-wrap{position:relative;background:#F2F4F7;margin:14px 20px 0;border-radius:12px;',
      'overflow:hidden;height:clamp(320px,55vh,600px);display:flex;align-items:center;justify-content:center}',
      '.cmx-ob-img{max-width:100%;width:auto;height:clamp(320px,55vh,600px);object-fit:contain;display:block;border-radius:8px}',
      '.cmx-ob-body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:10px}',
      '.cmx-ob-step-title{font-size:17px;font-weight:800;color:#0F172A;letter-spacing:-.03em;margin:0}',
      '.cmx-ob-step-desc{font-size:14px;color:#64748B;line-height:1.6;margin:0}',
      '.cmx-ob-nav{display:flex;align-items:center;justify-content:space-between;margin-top:4px}',
      '.cmx-ob-dots{display:flex;gap:6px;align-items:center}',
      '.cmx-ob-dot{width:8px;height:8px;border-radius:50%;background:#E2E8E4;border:none;padding:0;cursor:pointer;transition:background .2s,transform .2s}',
      '.cmx-ob-dot.on{background:#006847;transform:scale(1.25)}',
      '.cmx-ob-count{font-size:12px;font-weight:600;color:#94A3B8}',
      '.cmx-ob-arrows{display:flex;gap:8px;align-items:center}',
      '.cmx-ob-prev,.cmx-ob-next,.cmx-ob-fin{height:40px;border-radius:20px;border:none;cursor:pointer;',
      'font-size:13.5px;font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:0 18px;transition:background .15s,opacity .15s}',
      '.cmx-ob-prev{background:#F2F4F7;color:#0F172A}',
      '.cmx-ob-prev:hover{background:#E2E8E4}',
      '.cmx-ob-prev:disabled{opacity:.35;cursor:not-allowed}',
      '.cmx-ob-next{background:#006847;color:#fff}',
      '.cmx-ob-next:hover{background:#004D34}',
      '.cmx-ob-fin{background:#006847;color:#fff}',
      '.cmx-ob-fin:hover{background:#004D34}',
      '@media(max-width:480px){.cmx-ob-box{border-radius:14px}',
      '.cmx-ob-img-wrap{height:50vw}.cmx-ob-img{height:50vw}',
      '.cmx-ob-step-title{font-size:15px}.cmx-ob-step-desc{font-size:13px}}'
    ].join('');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var dotsHtml = steps.map(function (_, i) {
      return '<button class="cmx-ob-dot' + (i === 0 ? ' on' : '') + '" aria-label="Paso ' + (i + 1) + '" data-i="' + i + '"></button>';
    }).join('');

    var html = [
      '<div id="cmx-ob" role="dialog" aria-modal="true" aria-label="Cómo usar comparalo.mx">',
      '<div class="cmx-ob-box">',
      '<div class="cmx-ob-head">',
      '<a class="cmx-ob-logo" href="/">comparalo<em>.mx</em></a>',
      '<button class="cmx-ob-x" aria-label="Cerrar tutorial">×</button>',
      '</div>',
      '<div class="cmx-ob-img-wrap">',
      '<img class="cmx-ob-img" src="' + steps[0].img + '" alt="' + steps[0].alt + '" width="948" height="2000" loading="eager">',
      '</div>',
      '<div class="cmx-ob-body">',
      '<p class="cmx-ob-step-title">' + steps[0].title + '</p>',
      '<p class="cmx-ob-step-desc">' + steps[0].desc + '</p>',
      '<div class="cmx-ob-nav">',
      '<div class="cmx-ob-dots">' + dotsHtml + '</div>',
      '<span class="cmx-ob-count">1 / ' + steps.length + '</span>',
      '<div class="cmx-ob-arrows">',
      '<button class="cmx-ob-prev" aria-label="Paso anterior" disabled>← Anterior</button>',
      '<button class="cmx-ob-next" aria-label="Siguiente paso">Siguiente →</button>',
      '<button class="cmx-ob-fin" aria-label="Comenzar" style="display:none">¡Empezar →</button>',
      '</div>',
      '</div>',
      '</div>',
      '</div>',
      '</div>'
    ].join('');

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstChild);

    var modal = document.getElementById('cmx-ob');

    // Animar entrada
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('vis');
      });
    });

    // Cerrar con X
    modal.querySelector('.cmx-ob-x').addEventListener('click', close);

    // Cerrar fondo
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });

    // Anterior
    modal.querySelector('.cmx-ob-prev').addEventListener('click', function () {
      if (current > 0) { current--; render(); }
    });

    // Siguiente
    modal.querySelector('.cmx-ob-next').addEventListener('click', function () {
      if (current < steps.length - 1) { current++; render(); }
    });

    // Empezar
    modal.querySelector('.cmx-ob-fin').addEventListener('click', close);

    // Dots
    modal.querySelectorAll('.cmx-ob-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        current = parseInt(dot.getAttribute('data-i'), 10);
        render();
      });
    });

    // Teclado
    document.addEventListener('keydown', function onKey(e) {
      var m = document.getElementById('cmx-ob');
      if (!m) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && current < steps.length - 1) { current++; render(); }
      if (e.key === 'ArrowLeft' && current > 0) { current--; render(); }
    });

    // Marcar visto al cambiar de pestaña
    document.addEventListener('visibilitychange', onVisibility);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
