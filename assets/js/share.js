(function () {
  var css = document.createElement('style');
  css.textContent = [
    '.btn-share{background:none;border:1px solid var(--bd,#e2e2dc);border-radius:8px;padding:5px 10px;',
    'cursor:pointer;color:var(--tx2,#64748b);display:inline-flex;align-items:center;gap:5px;',
    'font-size:12px;font-weight:600;font-family:"Satoshi",sans-serif;',
    'transition:background .15s,color .15s,border-color .15s;white-space:nowrap;flex-shrink:0}',
    '.btn-share:hover{background:var(--s1,#f7f7f5);color:var(--tx,#0F172A);border-color:var(--bd2,#d0d0c8)}',
    '.btn-share svg{display:block;flex-shrink:0}',
    '@media(max-width:640px){.btn-share .share-txt{display:none}}',
    '.share-toast{position:fixed;bottom:76px;left:50%;transform:translateX(-50%) translateY(12px);',
    'background:#0F172A;color:#fff;padding:9px 18px;border-radius:10px;',
    'font-size:13px;font-weight:500;font-family:"Satoshi",sans-serif;',
    'opacity:0;pointer-events:none;transition:opacity .22s,transform .22s;',
    'z-index:9999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.18)}',
    '.share-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}'
  ].join('');
  document.head.appendChild(css);

  var toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.id = 'share-toast';
  toast.textContent = '¡Enlace copiado!';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(toast);
  });

  function showToast() {
    var t = document.getElementById('share-toast');
    if (!t) return;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function copyFallback(url) {
    var el = document.createElement('textarea');
    el.value = url;
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(el);
  }

  window.shareCurrentPage = async function () {
    var url   = location.href;
    var title = document.title;
    var desc  = (document.querySelector('meta[name="description"]') || {}).content || title;
    var method = (navigator.share) ? 'native' : 'clipboard';

    // GA4
    if (typeof gtag === 'function') {
      gtag('event', 'share', { method: method, content_type: 'page', item_id: url });
    }
    if (typeof window.trackEvent === 'function') {
      window.trackEvent('share_click', { method: method, page_url: url });
    }

    if (navigator.share) {
      try { await navigator.share({ title: title, text: desc, url: url }); }
      catch (e) { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        copyFallback(url);
      }
      showToast();
    }
  };
})();
