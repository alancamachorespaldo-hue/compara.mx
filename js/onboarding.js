/**
 * comparalo.mx — onboarding modal
 * Hero banner arriba (Amazon/ML), pasos debajo.
 * Solo aparece en la primera sesión del navegador.
 */
(function () {
  'use strict';

  var KEY = 'cmx_onboarding_v1';
  if (sessionStorage.getItem(KEY)) return;

  var steps = [
    {
      img: '/fotos/pasos/onboarding-01.jpg',
      alt: 'Comparativa de productos en comparalo.mx con botones Ver en Amazon y Mercado Libre',
      title: 'Compara y decide',
      desc: 'Ve precio, costo por porción, porciones y valoraciones de cada producto. Haz clic en "Ver en" para ir directo a Amazon MX o Mercado Libre.'
    },
    {
      img: '/fotos/pasos/onboarding-02.jpg',
      alt: 'Filtros de comparalo.mx por tipo, precio y características',
      title: 'Filtra por lo que importa',
      desc: 'Usa los filtros para afinar por tipo, precio máximo o plataforma. Ve solo los productos que te interesan.'
    },
    {
      img: '/fotos/pasos/onboarding-03.jpg',
      alt: 'Catálogo de productos en comparalo.mx con datos reales',
      title: 'Explora y selecciona',
      desc: 'Ve todos los productos con sus especificaciones reales. Selecciona hasta 3 para compararlos lado a lado.'
    },
    {
      img: '/fotos/pasos/onboarding-04.jpg',
      alt: 'Tabla comparativa de productos en comparalo.mx',
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

  function ga(eventName, params) {
    try {
      var p = Object.assign({ event_category: 'onboarding' }, params || {});
      if (typeof gtag === 'function') {
        gtag('event', eventName, p);
      } else {
        // gtag aún no cargó — encolar en dataLayer directamente
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: eventName, event_category: 'onboarding' });
        // reintentar cuando gtag esté disponible
        var attempts = 0;
        var retry = setInterval(function () {
          if (typeof gtag === 'function') {
            gtag('event', eventName, p);
            clearInterval(retry);
          } else if (++attempts > 20) {
            clearInterval(retry);
          }
        }, 200);
      }
    } catch (e) {}
  }

  function markSeen() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }

  function close(trigger) {
    ga('onboarding_closed', {
      step_number: current + 1,
      step_title: steps[current].title,
      trigger: trigger || 'unknown'
    });
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
    if (document.visibilityState === 'hidden') close('tab_switch');
  }

  function render(trigger) {
    var s = steps[current];
    var modal = document.getElementById('cmx-ob');
    if (!modal) return;

    var img = modal.querySelector('.cmx-ob-step-img');
    img.src = s.img;
    img.alt = s.alt;
    img.onerror = function(){ this.style.opacity='0'; this.closest('.cmx-ob-img-wrap').style.background='#EAF2EE'; };

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

    if (trigger) {
      ga('onboarding_step_view', {
        step_number: current + 1,
        step_title: s.title,
        trigger: trigger
      });
    }
  }

  function build() {
    var css = [
      '#cmx-ob{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
      'background:rgba(15,23,42,.65);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);',
      'padding:16px;transition:opacity .35s;opacity:0}',
      '#cmx-ob.vis{opacity:1}',

      /* caja */
      '.cmx-ob-box{background:#fff;border-radius:20px;width:100%;max-width:min(780px,95vw);',
      'max-height:96vh;overflow-y:hidden;box-shadow:0 28px 70px rgba(15,23,42,.25);display:flex;flex-direction:column}',

      /* hero banner superior */
      '.cmx-ob-hero{width:100%;height:82px;overflow:hidden;border-radius:20px 20px 0 0;flex-shrink:0;position:relative}',
      '.cmx-ob-hero-img{width:100%;height:100%;object-fit:cover;object-position:center 18%;display:block}',
      /* overlay oscuro suave para que el X se vea encima */
      '.cmx-ob-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,transparent 60%)}',

      /* X flotante sobre el hero */
      '.cmx-ob-x{position:absolute;top:14px;right:14px;z-index:2;width:34px;height:34px;border-radius:50%;',
      'border:1.5px solid rgba(255,255,255,.7);background:rgba(255,255,255,.25);',
      'backdrop-filter:blur(4px);cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'font-size:18px;color:#fff;line-height:1;transition:background .15s}',
      '.cmx-ob-x:hover{background:rgba(255,255,255,.45)}',

      /* cabecera (logo) */
      '.cmx-ob-head{display:flex;align-items:center;padding:16px 20px 0;flex-shrink:0}',
      '.cmx-ob-logo{font-size:15px;font-weight:800;letter-spacing:-.03em;color:#0F172A;text-decoration:none}',
      '.cmx-ob-logo em{color:#006847;font-style:normal}',

      /* imagen del paso */
      '.cmx-ob-img-wrap{margin:10px 18px 0;border-radius:12px;overflow:hidden;background:#F8FAFB;',
      'aspect-ratio:3/2;width:calc(100% - 36px);max-height:min(42vh,340px);',
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
      'border:1px solid #E2E8E4;box-shadow:0 2px 12px rgba(15,23,42,.07)}',
      '.cmx-ob-step-img{width:100%;height:100%;object-fit:contain;display:block}',

      /* texto */
      '.cmx-ob-body{padding:10px 20px 0;flex-shrink:0}',
      '.cmx-ob-step-title{font-size:16px;font-weight:800;color:#0F172A;letter-spacing:-.03em;margin:0 0 4px}',
      '.cmx-ob-step-desc{font-size:13.5px;color:#64748B;line-height:1.6;margin:0}',

      /* nav */
      '.cmx-ob-nav{display:flex;align-items:center;justify-content:space-between;padding:10px 20px 16px;flex-shrink:0}',
      '.cmx-ob-dots{display:flex;gap:6px;align-items:center}',
      '.cmx-ob-dot{width:8px;height:8px;border-radius:50%;background:#E2E8E4;border:none;padding:0;',
      'cursor:pointer;transition:background .2s,transform .2s}',
      '.cmx-ob-dot.on{background:#006847;transform:scale(1.3)}',
      '.cmx-ob-count{font-size:11px;font-weight:600;color:#94A3B8}',
      '.cmx-ob-arrows{display:flex;gap:8px;align-items:center}',
      '.cmx-ob-prev,.cmx-ob-next,.cmx-ob-fin{height:38px;border-radius:20px;border:none;cursor:pointer;',
      'font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:5px;padding:0 16px;transition:background .15s,opacity .15s}',
      '.cmx-ob-prev{background:#F2F4F7;color:#0F172A}',
      '.cmx-ob-prev:hover{background:#E2E8E4}',
      '.cmx-ob-prev:disabled{opacity:.3;cursor:not-allowed}',
      '.cmx-ob-next,.cmx-ob-fin{background:#006847;color:#fff}',
      '.cmx-ob-next:hover,.cmx-ob-fin:hover{background:#004D34}',

      '@media(max-width:480px){',
      '.cmx-ob-hero{height:64px}',
      '.cmx-ob-img-wrap{margin:8px 12px 0;width:calc(100% - 24px);max-height:38vh}',
      '.cmx-ob-head{padding:8px 14px 0}',
      '.cmx-ob-body{padding:8px 14px 0}',
      '.cmx-ob-nav{padding:8px 14px 12px}}'
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

      /* hero banner */
      '<div class="cmx-ob-hero">',
      '<img class="cmx-ob-hero-img" src="/fotos/pasos/ob-hero.jpg"',
      ' alt="comparalo.mx — compara precios en Amazon MX y Mercado Libre"',
      ' width="1280" height="320" loading="eager" decoding="async"',
      ' onerror="this.style.background=''#EAF2EE'';this.style.opacity=''0''">',',
      '<button class="cmx-ob-x" aria-label="Cerrar tutorial">×</button>',
      '</div>',

      /* logo */
      '<div class="cmx-ob-head">',
      '<a class="cmx-ob-logo" href="/">comparalo<em>.mx</em></a>',
      '</div>',

      /* imagen del paso */
      '<div class="cmx-ob-img-wrap">',
      '<img class="cmx-ob-step-img" src="' + steps[0].img + '" alt="' + steps[0].alt + '" width="1200" height="800" loading="eager">',
      '</div>',

      /* texto */
      '<div class="cmx-ob-body">',
      '<p class="cmx-ob-step-title">' + steps[0].title + '</p>',
      '<p class="cmx-ob-step-desc">' + steps[0].desc + '</p>',
      '</div>',

      /* nav */
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
      '</div>'
    ].join('');

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstChild);

    var modal = document.getElementById('cmx-ob');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('vis');
        ga('onboarding_shown', { step_number: 1, step_title: steps[0].title });
      });
    });

    modal.querySelector('.cmx-ob-x').addEventListener('click', function () { close('x_button'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) close('backdrop'); });

    modal.querySelector('.cmx-ob-prev').addEventListener('click', function () {
      if (current > 0) { current--; render('prev_arrow'); }
    });
    modal.querySelector('.cmx-ob-next').addEventListener('click', function () {
      if (current < steps.length - 1) { current++; render('next_arrow'); }
    });
    modal.querySelector('.cmx-ob-fin').addEventListener('click', function () {
      ga('onboarding_completed', { total_steps: steps.length });
      close('finish_button');
    });

    modal.querySelectorAll('.cmx-ob-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        current = parseInt(dot.getAttribute('data-i'), 10);
        render('dot');
      });
    });

    document.addEventListener('keydown', function onKey(e) {
      var m = document.getElementById('cmx-ob');
      if (!m) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') close('keyboard_escape');
      if (e.key === 'ArrowRight' && current < steps.length - 1) { current++; render('keyboard_arrow'); }
      if (e.key === 'ArrowLeft' && current > 0) { current--; render('keyboard_arrow'); }
    });

    document.addEventListener('visibilitychange', onVisibility);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
