/**
 * comparalo.mx — onboarding modal (split layout)
 * Hero fijo a la izquierda, pasos a la derecha.
 * Solo aparece en la primera sesión del navegador.
 * Se marca como visto al cerrar, hacer clic en "Empezar" o cambiar de pestaña.
 */
(function () {
  'use strict';

  var KEY = 'cmx_onboarding_v1';
  if (sessionStorage.getItem(KEY)) return;

  var steps = [
    {
      img: '/fotos/pasos/paso-1.jpg',
      alt: 'Busca lo que quieres comparar en comparalo.mx',
      title: 'Busca lo que quieres',
      desc: 'Escribe el producto o elige directamente una categoría: suplementos, bicicletas, laptops, celulares o electrodomésticos.'
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
      desc: 'Haz clic en "Ir a producto" para abrir el artículo directamente en Amazon MX o Mercado Libre al mejor precio.'
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
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380);
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

    var img = modal.querySelector('.cmx-ob-step-img');
    img.src = s.img;
    img.alt = s.alt;

    modal.querySelector('.cmx-ob-step-title').textContent = s.title;
    modal.querySelector('.cmx-ob-step-desc').textContent = s.desc;

    var dots = modal.querySelectorAll('.cmx-ob-dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('on', i === current);
      dots[i].setAttribute('aria-current', i === current ? 'step' : 'false');
    }

    modal.querySelector('.cmx-ob-prev').disabled = current === 0;

    var nextBtn = modal.querySelector('.cmx-ob-next');
    var finBtn  = modal.querySelector('.cmx-ob-fin');
    if (current === steps.length - 1) {
      nextBtn.style.display = 'none';
      finBtn.style.display  = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      finBtn.style.display  = 'none';
    }

    modal.querySelector('.cmx-ob-count').textContent = (current + 1) + ' / ' + steps.length;
  }

  function build() {
    var css = [
      /* overlay */
      '#cmx-ob{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
      'background:rgba(15,23,42,.65);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);',
      'padding:16px;transition:opacity .35s;opacity:0}',
      '#cmx-ob.vis{opacity:1}',

      /* box — split row */
      '.cmx-ob-box{background:#fff;border-radius:20px;width:100%;max-width:min(880px,95vw);',
      'max-height:90vh;overflow:hidden;box-shadow:0 28px 70px rgba(15,23,42,.25);',
      'display:flex;flex-direction:row}',

      /* LEFT — hero fijo */
      '.cmx-ob-hero{flex:0 0 42%;position:relative;overflow:hidden;background:#006847;',
      'display:flex;align-items:flex-start;justify-content:center}',
      '.cmx-ob-hero-img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}',

      /* RIGHT — pasos */
      '.cmx-ob-right{flex:1 1 0;display:flex;flex-direction:column;overflow:hidden}',
      '.cmx-ob-head{display:flex;align-items:center;justify-content:space-between;',
      'padding:20px 22px 0;flex-shrink:0}',
      '.cmx-ob-logo{font-size:15px;font-weight:800;letter-spacing:-.03em;color:#0F172A;text-decoration:none}',
      '.cmx-ob-logo em{color:#006847;font-style:normal}',
      '.cmx-ob-x{width:34px;height:34px;border-radius:50%;border:1.5px solid #E2E8E4;background:#fff;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;',
      'color:#64748B;line-height:1;transition:border-color .15s,color .15s;flex-shrink:0}',
      '.cmx-ob-x:hover{border-color:#006847;color:#006847}',

      /* step image */
      '.cmx-ob-img-wrap{margin:16px 22px 0;border-radius:12px;overflow:hidden;',
      'background:#F2F4F7;height:clamp(200px,30vh,340px);display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0}',
      '.cmx-ob-step-img{max-width:100%;height:clamp(200px,30vh,340px);width:auto;',
      'object-fit:contain;display:block;border-radius:8px}',

      /* body text */
      '.cmx-ob-body{padding:16px 22px 0;flex:1;display:flex;flex-direction:column;gap:6px}',
      '.cmx-ob-step-title{font-size:16px;font-weight:800;color:#0F172A;letter-spacing:-.03em;margin:0}',
      '.cmx-ob-step-desc{font-size:13.5px;color:#64748B;line-height:1.6;margin:0}',

      /* nav */
      '.cmx-ob-nav{display:flex;align-items:center;justify-content:space-between;',
      'padding:14px 22px 20px;flex-shrink:0}',
      '.cmx-ob-dots{display:flex;gap:6px;align-items:center}',
      '.cmx-ob-dot{width:8px;height:8px;border-radius:50%;background:#E2E8E4;border:none;padding:0;',
      'cursor:pointer;transition:background .2s,transform .2s}',
      '.cmx-ob-dot.on{background:#006847;transform:scale(1.3)}',
      '.cmx-ob-count{font-size:11px;font-weight:600;color:#94A3B8}',
      '.cmx-ob-arrows{display:flex;gap:8px;align-items:center}',
      '.cmx-ob-prev,.cmx-ob-next,.cmx-ob-fin{height:38px;border-radius:20px;border:none;cursor:pointer;',
      'font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:5px;',
      'padding:0 16px;transition:background .15s,opacity .15s}',
      '.cmx-ob-prev{background:#F2F4F7;color:#0F172A}',
      '.cmx-ob-prev:hover{background:#E2E8E4}',
      '.cmx-ob-prev:disabled{opacity:.3;cursor:not-allowed}',
      '.cmx-ob-next,.cmx-ob-fin{background:#006847;color:#fff}',
      '.cmx-ob-next:hover,.cmx-ob-fin:hover{background:#004D34}',

      /* mobile — stacked */
      '@media(max-width:640px){',
      '.cmx-ob-box{flex-direction:column;max-height:95vh}',
      '.cmx-ob-hero{flex:0 0 auto;height:180px}',
      '.cmx-ob-hero-img{object-position:top center}',
      '.cmx-ob-img-wrap{height:180px;margin:12px 16px 0}',
      '.cmx-ob-step-img{height:180px}',
      '.cmx-ob-head{padding:14px 16px 0}',
      '.cmx-ob-body{padding:12px 16px 0}',
      '.cmx-ob-nav{padding:12px 16px 16px}',
      '.cmx-ob-step-title{font-size:15px}',
      '.cmx-ob-step-desc{font-size:13px}}'
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

      /* hero izquierdo */
      '<div class="cmx-ob-hero">',
      '<img class="cmx-ob-hero-img" src="/fotos/pasos/ob-hero.jpg"',
      ' alt="comparalo.mx — compara precios en Amazon MX y Mercado Libre"',
      ' width="800" height="600" loading="eager">',
      '</div>',

      /* pasos derecho */
      '<div class="cmx-ob-right">',
      '<div class="cmx-ob-head">',
      '<a class="cmx-ob-logo" href="/">comparalo<em>.mx</em></a>',
      '<button class="cmx-ob-x" aria-label="Cerrar tutorial">×</button>',
      '</div>',
      '<div class="cmx-ob-img-wrap">',
      '<img class="cmx-ob-step-img" src="' + steps[0].img + '" alt="' + steps[0].alt + '" width="948" height="2000" loading="eager">',
      '</div>',
      '<div class="cmx-ob-body">',
      '<p class="cmx-ob-step-title">' + steps[0].title + '</p>',
      '<p class="cmx-ob-step-desc">' + steps[0].desc + '</p>',
      '</div>',
      '<div class="cmx-ob-nav">',
      '<div class="cmx-ob-dots">' + dotsHtml + '</div>',
      '<span class="cmx-ob-count">1 / ' + steps.length + '</span>',
      '<div class="cmx-ob-arrows">',
      '<button class="cmx-ob-prev" aria-label="Paso anterior" disabled>← Ant</button>',
      '<button class="cmx-ob-next" aria-label="Siguiente paso">Sig →</button>',
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

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { modal.classList.add('vis'); });
    });

    modal.querySelector('.cmx-ob-x').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    modal.querySelector('.cmx-ob-prev').addEventListener('click', function () {
      if (current > 0) { current--; render(); }
    });
    modal.querySelector('.cmx-ob-next').addEventListener('click', function () {
      if (current < steps.length - 1) { current++; render(); }
    });
    modal.querySelector('.cmx-ob-fin').addEventListener('click', close);

    modal.querySelectorAll('.cmx-ob-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        current = parseInt(dot.getAttribute('data-i'), 10);
        render();
      });
    });

    document.addEventListener('keydown', function onKey(e) {
      var m = document.getElementById('cmx-ob');
      if (!m) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && current < steps.length - 1) { current++; render(); }
      if (e.key === 'ArrowLeft' && current > 0) { current--; render(); }
    });

    document.addEventListener('visibilitychange', onVisibility);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
