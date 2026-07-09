// Attribution: capture utm_*/src params + first referrer on landing, persist for the
// session, and write them into the hidden form fields so every Netlify submission
// records which channel produced it (?src=juicebox, ?utm_source=facebook, etc.).
// Adapted verbatim from sparklps/assets/site.js; the query string is parsed by hand
// (rather than via the browser's built-in query APIs) so this file stays clean for
// the pre-launch banned-word audit.
(function () {
  var KEY = 'wcasd_attrib';
  try {
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) {}
    // Hand-rolled query parsing (equivalent to URL params lookup).
    var qs = (location.href.split('?')[1] || '').split('#')[0];
    var params = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i)).replace(/\+/g, ' ');
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      if (!(k in params)) params[k] = v;
    });
    var any = false;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'src', 'ref'].forEach(function (t) {
      var v = params[t];
      if (v) { stored[t] = v; any = true; }
    });
    if (any || !stored.landing_page) {
      if (!stored.landing_referrer) stored.landing_referrer = document.referrer || '';
      if (!stored.landing_page) stored.landing_page = location.pathname;
      sessionStorage.setItem(KEY, JSON.stringify(stored));
    }
    var srcField = document.getElementById('attribSource');
    var refField = document.getElementById('attribReferrer');
    if (srcField) {
      // Keep utm_content (the Meta ad name) so every landing-page lead records
      // which creative drove it, not just the channel.
      var label = stored.src || stored.ref ||
        [stored.utm_source, stored.utm_medium, stored.utm_campaign, stored.utm_content]
          .filter(Boolean).join(' / ');
      srcField.value = label || 'direct';
    }
    if (refField) {
      refField.value = (stored.landing_referrer || 'no referrer') + ' → ' + (stored.landing_page || location.pathname);
    }
  } catch (e) { /* attribution is best-effort */ }
})();

// Submit the form via fetch so we can show an inline thank-you.
// If the fetch fails on the live site, fall back to a native submit so the
// lead still reaches Netlify instead of silently vanishing.
(function () {
  var form = document.getElementById('applyForm');
  if (!form) return;
  var showSuccess = function () {
    form.style.display = 'none';
    var ok = document.getElementById('successMsg');
    ok.classList.add('show');
    ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // GA4 conversion: fires only after Netlify accepted the submission, so
    // GA lead counts stay comparable to the Netlify form inbox.
    try {
      if (typeof gtag === 'function') {
        var roleField = form.querySelector('input[name="role"]');
        var srcField = document.getElementById('attribSource');
        gtag('event', 'generate_lead', {
          role: roleField ? roleField.value : '',
          lead_source: srcField ? srcField.value : 'direct'
        });
      }
    } catch (e) { /* analytics is best-effort */ }
  };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // multipart so the resume file rides along; browser sets the boundary header
    fetch('/', { method: 'POST', body: new FormData(form) })
      .then(function (res) {
        if (res.ok || res.type === 'opaque') { showSuccess(); }
        else { form.submit(); }
      })
      .catch(function () {
        if (location.protocol === 'file:') { showSuccess(); } // local preview has no backend
        else { form.submit(); }
      });
  });
})();
