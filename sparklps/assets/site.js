// Attribution: capture utm_*/src params + first referrer on landing, persist for the
// session, and write them into the hidden form fields so every Netlify submission
// records which channel produced it (?src=juicebox, ?utm_source=facebook, etc.).
(function () {
  var KEY = 'spark_attrib';
  try {
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) {}
    var p = new URLSearchParams(location.search);
    var any = false;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'src', 'ref'].forEach(function (t) {
      var v = p.get(t);
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
      var label = stored.src || stored.ref ||
        [stored.utm_source, stored.utm_medium, stored.utm_campaign].filter(Boolean).join(' / ');
      srcField.value = label || 'direct';
    }
    if (refField) {
      refField.value = (stored.landing_referrer || 'no referrer') + ' → ' + (stored.landing_page || location.pathname);
    }
  } catch (e) { /* attribution is best-effort */ }
})();

// Submit the application via fetch so we can show an inline thank-you.
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
