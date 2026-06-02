// Submit the application via fetch so we can show an inline thank-you.
// Works with Netlify Forms on deploy; on local preview the POST fails and we still show success.
(function () {
  var form = document.getElementById('applyForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = new URLSearchParams(new FormData(form)).toString();
    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
      .catch(function () { /* local preview has no backend */ })
      .finally(function () {
        form.style.display = 'none';
        var ok = document.getElementById('successMsg');
        ok.classList.add('show');
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  });
})();
