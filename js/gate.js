/* Front-door password gate: blurs the page until the password is entered.
   Classic (non-module) script so it runs before the deferred app module. */
(function () {
  var PASSWORD = 'flourishing';
  var KEY = 'ahfem.unlocked';

  var gate = document.getElementById('gate');
  var form = document.getElementById('gateCard');
  var pw = document.getElementById('gatePw');
  var err = document.getElementById('gateErr');

  // the blurred page is decorative while locked — keep it out of tab order too
  function setInert(on) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] !== gate) kids[i].inert = on;
    }
  }

  function unlock() {
    setInert(false);
    document.body.classList.remove('locked');
    gate.remove();
    // let the canvas pick up its real size now that nothing is blurred
    window.dispatchEvent(new Event('resize'));
  }

  // stay unlocked for the rest of the browser session
  try { if (sessionStorage.getItem(KEY) === '1') { unlock(); return; } } catch (e) {}

  setInert(true);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (pw.value.trim().toLowerCase() === PASSWORD) {
      try { sessionStorage.setItem(KEY, '1'); } catch (e2) {}
      unlock();
      return;
    }
    err.style.display = 'block';
    pw.select();
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  });

  pw.focus();
})();
