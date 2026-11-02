/* ------------------------------------------------------------------
   Web CV — interactive layer
   1. Hover-to-focus: dwell on an item to reveal its details
      (tap on touch screens, Enter/Space on keyboard, Esc to close).
   2. Skill filter: click a skill to highlight every item that uses it.
   Everything degrades gracefully: without JS, details are shown inline.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  // UI strings, by page language (<html lang="…">).
  var STRINGS = {
    fr: {
      hintHover: 'Survolez un élément quelques instants pour voir les détails · cliquez sur une compétence pour la retrouver dans le CV.',
      hintTouch: 'Touchez un élément pour voir les détails · touchez une compétence pour la retrouver dans le CV.',
      items: function (n) { return n + (n > 1 ? ' éléments' : ' élément'); },
      next: 'Aller au suivant'
    },
    en: {
      hintHover: 'Hover over an item for a moment to see details · click a skill to find it in the CV.',
      hintTouch: 'Tap an item to see details · tap a skill to find it in the CV.',
      items: function (n) { return n + (n > 1 ? ' items' : ' item'); },
      next: 'Go to next'
    }
  };
  var T = STRINGS[document.documentElement.lang] || STRINGS.fr;

  var DWELL_MS = 700;   // how long to hover before an item opens
  var LEAVE_MS = 250;   // grace period before closing when the pointer leaves

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var body = document.body;

  /* ---------- E-mail (assembled at runtime against scrapers) ---------- */
  document.querySelectorAll('.js-email').forEach(function (a) {
    var addr = a.dataset.u + '@' + a.dataset.d;
    a.href = 'mailto:' + addr;
    a.textContent = addr;
  });

  /* ---------- Hint ---------- */
  var hint = document.getElementById('hint');
  if (hint) {
    hint.textContent = canHover ? T.hintHover : T.hintTouch;
    hint.hidden = false;
  }

  /* ---------- 1. Hover-to-focus ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll('.item'));
  var openItem = null;
  var dwellTimer = null;
  var leaveTimer = null;

  function open(item) {
    if (openItem === item) return;
    if (openItem) close();
    openItem = item;
    item.classList.remove('is-pending');
    item.classList.add('is-open');
    item.setAttribute('aria-expanded', 'true');
    body.classList.add('has-focus');
  }

  function close() {
    if (!openItem) return;
    openItem.classList.remove('is-open');
    openItem.setAttribute('aria-expanded', 'false');
    openItem = null;
    body.classList.remove('has-focus');
  }

  function toggle(item) {
    if (openItem === item) close(); else open(item);
  }

  items.forEach(function (item) {
    var more = item.querySelector('.more');
    if (!more) return;

    item.classList.add('has-more');
    item.tabIndex = 0;
    item.setAttribute('aria-expanded', 'false');
    if (more.id) item.setAttribute('aria-controls', more.id);

    // Mouse: dwell to open, leave to close.
    item.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(leaveTimer);
      if (openItem === item) return;
      clearTimeout(dwellTimer);
      item.classList.add('is-pending');
      dwellTimer = setTimeout(function () { open(item); }, DWELL_MS);
    });

    item.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(dwellTimer);
      item.classList.remove('is-pending');
      if (openItem === item) {
        leaveTimer = setTimeout(function () { if (openItem === item) close(); }, LEAVE_MS);
      }
    });

    // Click / tap: toggle (ignore links, buttons and text selection).
    item.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      if (String(window.getSelection())) return;
      clearTimeout(dwellTimer);
      item.classList.remove('is-pending');
      toggle(item);
    });

    // Keyboard.
    item.addEventListener('keydown', function (e) {
      if (e.target !== item) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(item);
      }
    });
  });

  // Click outside the open item closes it.
  document.addEventListener('click', function (e) {
    if (openItem && !openItem.contains(e.target) && !e.target.closest('.tag, .filterbar')) close();
  });

  /* ---------- 2. Skill filter ---------- */
  var bar = document.getElementById('filterbar');
  var barText = document.getElementById('filterbar-text');
  var barClear = document.getElementById('filterbar-clear');
  var activeSkill = null;
  var matches = [];
  var matchIndex = -1;

  function itemsFor(key) {
    return items.filter(function (it) {
      return (it.dataset.skills || '').split(/\s+/).indexOf(key) !== -1;
    });
  }

  // Upgrade tags that match at least one item into buttons.
  var tags = [];
  document.querySelectorAll('.tag[data-skill]').forEach(function (span) {
    var key = span.dataset.skill;
    var n = itemsFor(key).length;
    if (!n) return; // stays plain text
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag';
    btn.dataset.skill = key;
    btn.textContent = span.textContent;
    btn.setAttribute('aria-pressed', 'false');
    btn.title = T.items(n);
    span.replaceWith(btn);
    btn.addEventListener('click', function () {
      if (activeSkill === key) clearFilter(); else applyFilter(key, btn.textContent);
    });
    tags.push(btn);
  });

  function applyFilter(key, label) {
    close();
    activeSkill = key;
    matches = itemsFor(key);
    matchIndex = -1;
    body.classList.add('filtering');
    items.forEach(function (it) { it.classList.toggle('match', matches.indexOf(it) !== -1); });
    tags.forEach(function (t) { t.setAttribute('aria-pressed', String(t.dataset.skill === key)); });
    barText.textContent = label + ' · ' + T.items(matches.length) + ' ↓';
    barText.title = T.next;
    bar.hidden = false;
  }

  function clearFilter() {
    activeSkill = null;
    matches = [];
    body.classList.remove('filtering');
    items.forEach(function (it) { it.classList.remove('match'); });
    tags.forEach(function (t) { t.setAttribute('aria-pressed', 'false'); });
    bar.hidden = true;
  }

  // Clicking the bar text jumps to the next match.
  barText.addEventListener('click', function () {
    if (!matches.length) return;
    matchIndex = (matchIndex + 1) % matches.length;
    matches[matchIndex].scrollIntoView({
      block: 'center',
      behavior: reduceMotion.matches ? 'auto' : 'smooth'
    });
  });
  barClear.addEventListener('click', clearFilter);

  /* ---------- Escape closes everything ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (openItem) { var it = openItem; close(); it.focus(); }
    else if (activeSkill) clearFilter();
  });
})();
