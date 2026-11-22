/* Sidebar groups: one group open at a time, the group holding the current page
   opens automatically, and the "Filter pages" box searches across all groups. */
(function () {
  'use strict';
  var root = document.querySelector('.sidebar-tabs');
  if (!root) return;
  var groups = Array.prototype.slice.call(root.querySelectorAll('.nav-group'));
  var input = document.getElementById('sidebarTabSearch');
  var filtering = false;

  function setOpen(g, open) {
    g.classList.toggle('is-open', open);
    var h = g.querySelector('.nav-group-head');
    if (h) h.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function openOnly(g) { groups.forEach(function (x) { setOpen(x, x === g); }); }
  function activeGroup() {
    var a = root.querySelector('.tab-button.active');
    return a ? a.closest('.nav-group') : null;
  }

  groups.forEach(function (g) {
    var head = g.querySelector('.nav-group-head');
    if (!head) return;
    head.addEventListener('click', function () {
      if (filtering) return;
      var willOpen = !g.classList.contains('is-open');
      groups.forEach(function (x) { setOpen(x, x === g ? willOpen : false); });
    });
  });

  /* keep the group of the current page open whenever the active page changes */
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (filtering) return;
      var g = activeGroup();
      if (g && !g.classList.contains('is-open')) openOnly(g);
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* filter: the original handler hides/shows buttons; this runs right after it
     to hide empty groups and expand the rest while a search is active */
  if (input) {
    input.addEventListener('input', function () {
      setTimeout(function () {
        var term = (input.value || '').trim();
        filtering = !!term;
        groups.forEach(function (g) {
          var any = Array.prototype.some.call(g.querySelectorAll('.tab-button'), function (b) { return b.style.display !== 'none'; });
          g.hidden = !any;
          if (term) setOpen(g, true);
        });
        if (!term) openOnly(activeGroup() || groups[0]);
      }, 0);
    });
  }

  var start = activeGroup();
  if (start) openOnly(start);
})();
