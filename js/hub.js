/* CUDWEARS | Services, Rentals and List (registration). Same layout as CUDWEARS's hub.
   Listings come from the Supabase `listings` table (approved rows). New sign-ups are saved as PENDING in Supabase,
   shown to the person on their own device, and sent to CUDWEARS on WhatsApp. Approve them in Admin > Listings. */
(function () {
  'use strict';

  var WA_NUMBER = (window.CFG && CFG.wa) || '2348028699824';
  var STORE_KEY = 'cudwears_listings_v1';
  var SHOW_SAMPLE_TAG = true;

  var STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

  var SERVICE_GROUPS = [
    { id: 'fashion', name: 'Tailoring & Design', icon: 'scissors', types: ['Tailor', 'Fashion Designer', 'Pattern Maker', 'Aso-ebi Seamstress', 'Shoemaker / Cobbler'] },
    { id: 'fitting', name: 'Fittings & Measurements', icon: 'rulers', types: ['Fitting Session', 'Personal Stylist', 'Measurement Taker'] },
    { id: 'alter', name: 'Alterations & Repairs', icon: 'wrench-adjustable', types: ['Alterations', 'Zip & Button Repair', 'Shoe Repair', 'Bag Repair'] },
    { id: 'craft', name: 'Embroidery & Craft', icon: 'brush', types: ['Embroidery & Beadwork', 'Adire / Tie-dye Maker', 'Weaving', 'Crochet & Knitwear', 'Monogramming'] },
    { id: 'care', name: 'Laundry & Care', icon: 'droplet', types: ['Laundry & Dry Cleaning', 'Ironing & Steaming', 'Fabric Dyeing'] }
  ];
  var RENTAL_GROUPS = [
    { id: 'wear', name: 'Outfits', icon: 'handbag', types: ['Gowns & Evening Dresses', 'Suits & Tuxedos', 'Aso-ebi & Traditional Attire', 'Costumes', 'Uniforms & Corporate Wear'] },
    { id: 'bridal', name: 'Bridal', icon: 'heart', types: ['Bridal Gowns & Veils', 'Bridesmaid Dresses', 'Groom Wear'] },
    { id: 'acc', name: 'Accessories', icon: 'gem', types: ['Jewellery & Accessories', 'Shoes & Bags', 'Gele, Caps & Fascinators'] },
    { id: 'gear', name: 'Sewing & Studio Gear', icon: 'camera', types: ['Sewing Machine', 'Mannequin', 'Photo Studio'] }
  ];
  var SERVICE_UNITS = ['per job', 'per hour', 'per day', 'per visit', 'per session', 'per event', 'per project', 'per month'];
  var RENTAL_UNITS = ['per hour', 'per day', 'per night', 'per week', 'per event', 'per month'];

  // Listings come from Supabase (approved rows). See setup/supabase.sql.
  function dbRows() {
    return ((window.CWX && CWX.listings) || []).filter(function (r) { return r.kind === 'service' || r.kind === 'rental'; }).map(function (r) {
      return { id: r.id, kind: r.kind, g: r.grp, t: r.type, n: r.name, d: r.descr || '', s: r.state || 'Online', c: r.city || 'Online', p: r.price || 0, u: r.unit || '', x: r.extra || '', r: Number(r.rating) || 0, rv: r.reviews || 0, v: !!r.verified, rm: !!r.remote, nw: !!r.nationwide, av: r.available !== false, phone: r.phone || '', sample: !!r.sample };
    });
  }

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function ico(name) { return el('i', { class: 'bi bi-' + name, 'aria-hidden': 'true' }); }
  function toast(m) { if (typeof showToast === 'function') showToast(m, 2600); }
  function money(n) { return '\u20A6' + Number(n).toLocaleString('en-NG'); }
  function groupsOf(kind) { return kind === 'rental' ? RENTAL_GROUPS : SERVICE_GROUPS; }
  function groupById(kind, id) { return groupsOf(kind).filter(function (g) { return g.id === id; })[0]; }
  function normPhone(raw) {
    var d = String(raw || '').replace(/[^\d]/g, '');
    if (/^0\d{10}$/.test(d)) return '234' + d.slice(1);
    return d;
  }
  function openWA(num, text) {
    var url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
    var w = null; try { w = window.open(url, '_blank'); } catch (e) {}
    if (!w) location.href = url;
  }
  function loadSaved() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; } }
  function saveSaved(list) { try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function allListings() { return loadSaved().concat(dbRows()); }
  function marketCats() { return Object.keys(CW.CATS).map(function (k) { return { f: CW.CATS[k], t: CW.CATS[k] }; }); }
  function go(tab) { if (typeof openTab === 'function') openTab(null, tab); window.scrollTo(0, 0); var m = document.querySelector('.content-main'); if (m) m.scrollTop = 0; }

  // ---------- details sheet ----------
  var sheet;
  function ensureSheet() {
    if (sheet) return sheet;
    sheet = el('div', { class: 'hub-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Listing details' }, [
      el('div', { class: 'scrim', onclick: closeSheet }),
      el('div', { class: 'panel', id: 'hubSheetPanel', tabindex: '-1' })
    ]);
    document.body.appendChild(sheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    return sheet;
  }
  function closeSheet() { if (sheet) sheet.classList.remove('open'); }
  function contactNumber(l) { return l.phone ? normPhone(l.phone) : WA_NUMBER; }
  function enquiryText(l) {
    var verb = l.kind === 'rental' ? 'check availability and price' : 'book';
    return 'Hello' + (l.phone ? '' : ' CUDWEARS') + ', I found ' + l.n + ' (' + l.t + ') on CUDWEARS and would like to ' + verb + '.\n\nLocation: ' + l.c + ', ' + l.s + '\nListing ref: ' + l.id + '\n\nMy name:\nDate / time needed:\nDetails:';
  }
  function openSheet(l) {
    ensureSheet();
    var p = $('hubSheetPanel'); p.textContent = '';
    var g = groupById(l.kind, l.g);
    var rows = [['Category', (g ? g.name : '') + ' \u203A ' + l.t], ['Where', l.c + ', ' + l.s + (l.nw ? ' (also travels nationwide)' : '')]];
    if (l.rm) rows.push(['Remote', 'Works online, serves clients abroad too']);
    if (l.p) rows.push(['Price', 'From ' + money(l.p) + ' ' + l.u]);
    if (l.x) rows.push([l.kind === 'rental' ? 'Capacity' : 'Experience', l.x]);
    rows.push(['Rating', l.rv ? '\u2605 ' + l.r + ' (' + l.rv + ' reviews)' : 'New on CUDWEARS']);
    rows.push(['Status', (l.v ? 'Verified by CUDWEARS' : l.pending ? 'Pending review (visible only on this device)' : 'Not yet verified') + (l.av ? ' \u00B7 Available now' : ' \u00B7 Booked, ask for dates')]);
    var dl = el('dl'); rows.forEach(function (r) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); });
    var actions = el('div', { class: 'sheet-actions' }, [
      el('button', { type: 'button', class: 'btn btn-success', onclick: function () { openWA(contactNumber(l), enquiryText(l)); } }, [ico('whatsapp'), ' ' + (l.kind === 'rental' ? 'Check availability' : 'Book on WhatsApp')]),
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeSheet, text: 'Close' })
    ]);
    if (l.mine) actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { saveSaved(loadSaved().filter(function (x) { return x.id !== l.id; })); closeSheet(); refreshAll(); toast('Listing removed from this device'); }, text: 'Remove' }));
    p.appendChild(el('div', { class: 'grab' }));
    p.appendChild(el('h3', { text: l.n }));
    p.appendChild(el('p', { text: l.d, class: 'mb-0' }));
    p.appendChild(dl); p.appendChild(actions);
    sheet.classList.add('open'); p.focus();
  }

  // ---------- directory app (services / rentals) ----------
  var apps = {};
  function buildApp(kind, root) {
    if (!root) return;
    var st = { g: '', t: '', q: '', loc: '', sort: 'top', ver: false, av: false };
    var groups = groupsOf(kind);
    var isSvc = kind === 'service';
    var search = el('input', { type: 'search', placeholder: isSvc ? 'Search tailor, designer, fitting, laundry\u2026' : 'Search gown, suit, aso-ebi, bridal\u2026', 'aria-label': 'Search', autocomplete: 'off', oninput: function () { st.q = this.value; render(); } });
    var groupRow = el('div', { class: 'chip-row', role: 'tablist', 'aria-label': 'Categories' });
    var typeRow = el('div', { class: 'chip-row', 'aria-label': 'Types' });
    var locSel = el('select', { class: 'hub-select', 'aria-label': 'Location', onchange: function () { st.loc = this.value; render(); } }, [
      el('option', { value: '', text: 'Anywhere' }), el('option', { value: 'remote', text: 'Online / Remote (worldwide)' })
    ].concat(STATES.map(function (s) { return el('option', { value: s, text: s }); })));
    var sortSel = el('select', { class: 'hub-select', 'aria-label': 'Sort', onchange: function () { st.sort = this.value; render(); } }, [
      ['top', 'Top rated'], ['new', 'Newest'], ['low', 'Price: low to high'], ['high', 'Price: high to low']
    ].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    var verChip = el('button', { type: 'button', class: 'chip sub', 'aria-pressed': 'false', onclick: function () { st.ver = !st.ver; render(); } }, [ico('patch-check'), ' Verified']);
    var avChip = el('button', { type: 'button', class: 'chip sub', 'aria-pressed': 'false', onclick: function () { st.av = !st.av; render(); } }, [ico('clock'), isSvc ? ' Available now' : ' Available']);
    var count = el('p', { class: 'hub-count', 'aria-live': 'polite' });
    var grid = el('div', { class: 'hub-grid' });
    var bar = el('div', { class: 'hub-toolbar' }, [
      el('div', { class: 'hub-search' }, [ico('search'), search]), groupRow, typeRow,
      el('div', { class: 'hub-filters' }, [locSel, sortSel]), el('div', { class: 'hub-toggles' }, [verChip, avChip])
    ]);
    root.textContent = ''; root.appendChild(bar); root.appendChild(count); root.appendChild(grid);

    function chip(label, active, fn, icon, sub) {
      var b = el('button', { type: 'button', class: 'chip' + (active ? ' active' : '') + (sub ? ' sub' : ''), 'aria-pressed': String(!!active), onclick: fn }, [icon ? ico(icon) : null, (icon ? ' ' : '') + label]);
      return b;
    }
    function drawChips() {
      groupRow.textContent = ''; typeRow.textContent = '';
      groupRow.appendChild(chip('All', !st.g, function () { st.g = ''; st.t = ''; render(); }, 'grid'));
      groups.forEach(function (g) { groupRow.appendChild(chip(g.name, st.g === g.id, function () { st.g = g.id; st.t = ''; render(); }, g.icon)); });
      var cur = st.g && groupById(kind, st.g);
      typeRow.hidden = !cur;
      if (cur) { typeRow.appendChild(chip('All ' + cur.name, !st.t, function () { st.t = ''; render(); }, null, true)); cur.types.forEach(function (t) { typeRow.appendChild(chip(t, st.t === t, function () { st.t = t; render(); }, null, true)); }); }
    }
    function match(l) {
      if (l.kind !== kind) return false;
      if (st.g && l.g !== st.g) return false;
      if (st.t && l.t !== st.t) return false;
      if (st.ver && !l.v) return false;
      if (st.av && !l.av) return false;
      if (st.loc === 'remote') { if (!l.rm) return false; }
      else if (st.loc && l.s !== st.loc && !l.nw) return false;
      if (st.q) {
        var g = groupById(kind, l.g), hay = [l.n, l.t, g ? g.name : '', l.d, l.c, l.s].join(' ').toLowerCase();
        return st.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) > -1; });
      }
      return true;
    }
    function card(l) {
      var g = groupById(kind, l.g);
      var meta = el('div', { class: 'meta' }, [
        l.v ? el('span', { class: 'tagx brass' }, [ico('patch-check'), ' Verified']) : null,
        l.pending ? el('span', { class: 'tagx' }, ['Pending review']) : null,
        l.av ? el('span', { class: 'tagx ok' }, [ico('circle-fill'), ' Available']) : el('span', { class: 'tagx' }, ['Booked']),
        l.rm ? el('span', { class: 'tagx' }, [ico('globe2'), ' Remote']) : null,
        l.nw ? el('span', { class: 'tagx' }, [ico('signpost-split'), ' Nationwide']) : null,
        (l.sample && SHOW_SAMPLE_TAG) ? el('span', { class: 'tagx' }, ['Sample']) : null
      ]);
      return el('article', { class: 'pcard', tabindex: '0', role: 'button', 'aria-label': l.n + ', ' + l.t + ', ' + l.c, onclick: function () { openSheet(l); }, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(l); } } }, [
        el('div', { class: 'pcard-top' }, [
          el('div', { class: 'avatar' }, [ico(g ? g.icon : 'person')]),
          el('div', {}, [el('h3', { text: l.n }), el('p', { class: 'sub', text: l.t + ' \u00B7 ' + l.c + ', ' + l.s }), el('p', { class: 'sub', text: l.rv ? '\u2605 ' + l.r + ' (' + l.rv + ')' : 'New' })])
        ]),
        el('p', { class: 'desc', text: l.d }), meta,
        el('div', { class: 'pcard-foot' }, [
          el('span', { class: 'price' }, [l.p ? el('small', { text: 'From ' }) : null, l.p ? money(l.p) : 'Ask for price', l.p ? el('small', { text: ' ' + l.u }) : null]),
          el('span', { class: 'btn btn-success', 'aria-hidden': 'true' }, [isSvc ? 'Book' : 'Check'])
        ])
      ]);
    }
    function render() {
      drawChips();
      verChip.classList.toggle('active', st.ver); verChip.setAttribute('aria-pressed', String(st.ver));
      avChip.classList.toggle('active', st.av); avChip.setAttribute('aria-pressed', String(st.av));
      var list = allListings().filter(match);
      var score = function (l) { return l.r * Math.log(2 + l.rv); };
      list.sort(function (a, b) {
        if (st.sort === 'low') return (a.p || 1e12) - (b.p || 1e12);
        if (st.sort === 'high') return (b.p || 0) - (a.p || 0);
        if (st.sort === 'new') return (b.mine ? 1 : 0) - (a.mine ? 1 : 0);
        return score(b) - score(a);
      });
      grid.textContent = '';
      count.textContent = list.length + (list.length === 1 ? ' result' : ' results') + (st.loc && st.loc !== 'remote' ? ' in ' + st.loc + ' and nationwide' : st.loc === 'remote' ? ' available online' : ' across Nigeria and online');
      if (!list.length) {
        var what = st.t || (st.g && groupById(kind, st.g).name) || st.q || (isSvc ? 'a tailor or service' : 'an outfit to rent');
        grid.appendChild(el('div', { class: 'hub-empty', style: 'grid-column:1/-1' }, [
          el('p', { text: 'No ' + (isSvc ? 'providers' : 'listings') + ' match yet.' }),
          el('div', { class: 'sheet-actions', style: 'justify-content:center' }, [
            el('button', { type: 'button', class: 'btn btn-success', onclick: function () { openWA(WA_NUMBER, 'Hello CUDWEARS, I am looking for ' + what + (st.loc && st.loc !== 'remote' ? ' in ' + st.loc : '') + '. Please help me find one.'); } }, [ico('whatsapp'), ' Ask CUDWEARS to find one']),
            el('button', { type: 'button', class: 'btn btn-ghost', 'data-reg': kind, text: isSvc ? 'Offer this service' : 'List a rental' })
          ])
        ]));
        return;
      }
      var frag = document.createDocumentFragment(); list.forEach(function (l) { frag.appendChild(card(l)); }); grid.appendChild(frag);
    }
    apps[kind] = { render: render, state: st, setGroup: function (id, type) { st.g = id || ''; st.t = type || ''; render(); } };
    render();
  }

  // ---------- registration ----------
  function buildRegister() {
    var root = $('regApp'); if (!root) return;
    var kind = 'service';
    var storeCats = marketCats().map(function (c) { return c.f; });
    var kinds = [['service', 'scissors', 'Service'], ['rental', 'handbag', 'Rental'], ['store', 'shop', 'Designer / Store']];
    var seg = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'What do you offer' });
    var f = {};
    function field(id, label, control, hint) { return el('div', {}, [el('label', { for: id, text: label }), control, hint ? el('div', { class: 'hint', text: hint }) : null, el('div', { class: 'field-err', id: id + 'Err', role: 'alert', hidden: true })]); }
    f.name = el('input', { id: 'rName', type: 'text', maxlength: '80', autocomplete: 'organization', placeholder: 'Your name or business name' });
    f.group = el('select', { id: 'rGroup', onchange: fillTypes });
    f.type = el('select', { id: 'rType', onchange: toggleOther });
    f.other = el('input', { id: 'rOther', type: 'text', maxlength: '50', placeholder: 'Type your service or item', hidden: true });
    f.desc = el('textarea', { id: 'rDesc', maxlength: '300', placeholder: 'What you do, what is included, how clients can reach you\u2026' });
    f.state = el('select', { id: 'rState' }, [el('option', { value: '', text: 'Select state' })].concat(STATES.map(function (s) { return el('option', { value: s, text: s }); })));
    f.city = el('input', { id: 'rCity', type: 'text', maxlength: '60', autocomplete: 'address-level2', placeholder: 'City or area' });
    f.price = el('input', { id: 'rPrice', type: 'number', inputmode: 'numeric', min: '0', placeholder: 'e.g. 15000' });
    f.unit = el('select', { id: 'rUnit' });
    f.extra = el('input', { id: 'rExtra', type: 'text', maxlength: '60' });
    f.phone = el('input', { id: 'rPhone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '0803 000 0000 or +44\u2026' });
    f.nw = el('input', { type: 'checkbox', id: 'rNw' }); f.rm = el('input', { type: 'checkbox', id: 'rRm' }); f.deliver = el('input', { type: 'checkbox', id: 'rDel' });
    var extraWrap = field('rExtra', 'Experience', f.extra);
    var priceRow = el('div', { class: 'reg-row two' }, [field('rPrice', 'Starting price (\u20A6)', f.price, 'Optional'), field('rUnit', 'Charged', f.unit)]);
    var checks = el('div', { class: 'checks' }, [
      el('label', {}, [f.nw, 'I travel / ship nationwide']), el('label', {}, [f.rm, 'I work online (serve clients abroad)']), el('label', { id: 'rDelWrap' }, [f.deliver, 'I deliver'])
    ]);
    var submit = el('button', { type: 'submit', class: 'btn btn-success', style: 'justify-self:start' }, [ico('send'), ' Register']);
    var form = el('form', { class: 'reg-form', novalidate: true, onsubmit: onSubmit }, [
      seg, field('rName', 'Name / business', f.name), el('div', { class: 'reg-row two' }, [field('rGroup', 'Category', f.group), field('rType', 'Type', f.type)]),
      field('rOther', 'Your own type', f.other), field('rDesc', 'Short description', f.desc),
      el('div', { class: 'reg-row two' }, [field('rState', 'State', f.state), field('rCity', 'City / area', f.city)]),
      el('div', {}, [el('label', { text: 'Coverage' }), checks]), priceRow, extraWrap,
      field('rPhone', 'WhatsApp number', f.phone, 'Customers contact you here. Include the country code if outside Nigeria.'), submit
    ]);
    var result = el('div', { class: 'reg-ok', hidden: true, 'aria-live': 'polite' });
    root.textContent = ''; root.appendChild(form); root.appendChild(result);

    function setKind(k) {
      kind = k;
      seg.textContent = '';
      kinds.forEach(function (x) { seg.appendChild(el('button', { type: 'button', class: x[0] === kind ? 'active' : '', 'aria-pressed': String(x[0] === kind), onclick: function () { setKind(x[0]); } }, [ico(x[1]), x[2]])); });
      f.group.textContent = '';
      f.group.appendChild(el('option', { value: '', text: 'Select category' }));
      if (kind === 'store') storeCats.forEach(function (c) { f.group.appendChild(el('option', { value: c, text: c })); });
      else groupsOf(kind).forEach(function (g) { f.group.appendChild(el('option', { value: g.id, text: g.name })); });
      f.unit.textContent = ''; (kind === 'rental' ? RENTAL_UNITS : SERVICE_UNITS).forEach(function (u) { f.unit.appendChild(el('option', { value: u, text: u })); });
      f.type.parentNode.hidden = kind === 'store'; f.other.hidden = true; f.other.parentNode.hidden = true;
      priceRow.hidden = kind === 'store'; extraWrap.hidden = kind === 'store';
      extraWrap.querySelector('label').textContent = kind === 'rental' ? 'Capacity / quantity' : 'Experience';
      f.extra.placeholder = kind === 'rental' ? 'e.g. seats 200, or 10 units' : 'e.g. 5 years';
      $('rDelWrap').hidden = kind !== 'store'; f.rm.parentNode.hidden = kind === 'store';
      fillTypes();
    }
    function fillTypes() {
      f.type.textContent = '';
      var g = kind !== 'store' && groupById(kind, f.group.value);
      f.type.appendChild(el('option', { value: '', text: g ? 'Select type' : 'Pick a category first' }));
      if (g) { g.types.forEach(function (t) { f.type.appendChild(el('option', { value: t, text: t })); }); f.type.appendChild(el('option', { value: '__other', text: 'Other (type it)' })); }
      toggleOther();
    }
    function toggleOther() { var o = f.type.value === '__other'; f.other.hidden = !o; f.other.parentNode.hidden = !o; }
    function err(id, msg) { var e = $(id + 'Err'); if (e) { e.textContent = msg || ''; e.hidden = !msg; } return !msg; }
    function onSubmit(ev) {
      ev.preventDefault();
      var ok = true, phone = normPhone(f.phone.value), isStore = kind === 'store';
      ok = err('rName', f.name.value.trim().length < 2 ? 'Enter your name or business name.' : '') && ok;
      ok = err('rGroup', !f.group.value ? 'Choose a category.' : '') && ok;
      if (!isStore) ok = err('rType', !f.type.value ? 'Choose a type.' : '') && ok; else err('rType', '');
      if (!isStore && f.type.value === '__other') ok = err('rOther', f.other.value.trim().length < 2 ? 'Type what you offer.' : '') && ok; else err('rOther', '');
      ok = err('rDesc', f.desc.value.trim().length < 10 ? 'Add a short description (10+ characters).' : '') && ok;
      ok = err('rState', (!f.state.value && !f.rm.checked) ? 'Choose a state, or tick online.' : '') && ok;
      ok = err('rCity', (!f.city.value.trim() && !f.rm.checked) ? 'Enter your city or area.' : '') && ok;
      ok = err('rPhone', !/^\d{10,15}$/.test(phone) ? 'Enter a valid WhatsApp number.' : '') && ok;
      if (!ok) { var first = form.querySelector('.field-err:not([hidden])'); if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      var g = isStore ? null : groupById(kind, f.group.value);
      var type = isStore ? f.group.value : (f.type.value === '__other' ? f.other.value.trim() : f.type.value);
      var rec = { id: 'me-' + Date.now().toString(36), kind: isStore ? 'store' : kind, g: f.group.value, t: type, n: f.name.value.trim(), d: f.desc.value.trim(), s: f.state.value || 'Online', c: f.city.value.trim() || 'Online', p: Number(f.price.value) || 0, u: f.unit.value, x: f.extra.value.trim(), r: 0, rv: 0, v: false, rm: f.rm.checked, nw: f.nw.checked, av: true, phone: phone, mine: true, pending: true };
      var saved = false;
      if (!isStore) { var list = loadSaved(); list.unshift(rec); saved = saveSaved(list.slice(0, 20)); }
      var label = isStore ? 'Designer / Store' : kind === 'rental' ? 'Rental host' : 'Service provider';
      var msg = 'Hello CUDWEARS, I want to register on CUDWEARS as a ' + label + '.\n\nName: ' + rec.n + '\nCategory: ' + (g ? g.name + ' > ' : '') + (isStore ? f.group.value : type) + '\nAbout: ' + rec.d + '\nLocation: ' + rec.c + ', ' + rec.s + '\nCoverage: ' + [rec.nw ? 'nationwide' : '', rec.rm ? 'online / international' : '', isStore && f.deliver.checked ? 'delivers' : ''].filter(Boolean).join(', ') + (rec.p ? '\nPrice: from ' + money(rec.p) + ' ' + rec.u : '') + (rec.x ? '\n' + (kind === 'rental' ? 'Capacity: ' : 'Experience: ') + rec.x : '') + '\nWhatsApp: +' + phone;
      form.hidden = true; result.hidden = false; result.textContent = '';
      result.appendChild(el('div', { class: 'avatar', style: 'margin:0 auto .6rem' }, [ico('check2')]));
      result.appendChild(el('h3', { text: 'Almost done, ' + rec.n.split(' ')[0] }));
      var note = el('p', { text: 'Sending your listing\u2026' });
      result.appendChild(note);
      var row = { kind: rec.kind, grp: f.group.value, type: type, name: rec.n, descr: rec.d, state: rec.s, city: rec.c, price: rec.p || 0, unit: isStore ? '' : rec.u, extra: rec.x || '', phone: phone, remote: rec.rm, nationwide: rec.nw, available: true, status: 'pending' };
      var sent = window.CWX ? CWX.sb.from('listings').insert(row).then(function (r) { return !r.error; }, function () { return false; }) : Promise.resolve(false);
      sent.then(function (ok) {
        note.textContent = ok ? 'Your listing has been received and is waiting for review. ' + (saved ? 'You can see it on this device now. ' : '') + 'Send it to CUDWEARS on WhatsApp too so we can verify and publish it quickly.' : (saved ? 'Your listing is saved on this device. ' : '') + 'We could not reach the server, so please send your details to CUDWEARS on WhatsApp and we will publish your listing.';
      });
      result.appendChild(el('div', { class: 'sheet-actions', style: 'justify-content:center' }, [
        el('button', { type: 'button', class: 'btn btn-success', onclick: function () { openWA(WA_NUMBER, msg); } }, [ico('whatsapp'), ' Send to CUDWEARS']),
        !isStore ? el('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { go(kind === 'rental' ? 'tab14' : 'tab13'); } }, ['See my listing']) : null,
        el('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { form.reset(); setKind(kind); result.hidden = true; form.hidden = false; }, text: 'Register another' })
      ]));
      refreshAll();
    }
    root._setKind = setKind; setKind('service');
  }

  function refreshAll() { Object.keys(apps).forEach(function (k) { apps[k].render(); }); }

  // ---------- navigation glue ----------
  function syncNav(id) {
    document.querySelectorAll('.footer-nav .nav-item').forEach(function (n) { n.classList.toggle('active', (n.getAttribute('onclick') || '').indexOf("'" + id + "'") > -1); });
  }
  function wrapOpenTab() {
    if (typeof window.openTab !== 'function' || window.openTab._hub) return;
    var orig = window.openTab;
    window.openTab = function (e, id) { var r = orig.apply(this, arguments); syncNav(id); return r; };
    window.openTab._hub = true;
  }
  function init() {
    wrapOpenTab();
    buildApp('service', $('svcApp')); buildApp('rental', $('rentApp'));
    buildRegister();
    if (window.CWX) CWX.onData(refreshAll);
    document.addEventListener('click', function (e) {
      var r = e.target.closest('[data-reg]');
      if (r) { e.preventDefault(); closeSheet(); go('tab15'); var k = r.getAttribute('data-reg'); var root = $('regApp'); if (root && root._setKind) { var res = root.querySelector('.reg-ok'); if (res) res.hidden = true; var fm = root.querySelector('form'); if (fm) fm.hidden = false; root._setKind(k === 'rental' || k === 'store' ? k : 'service'); } return; }
      var s = e.target.closest('[data-svc-group]');
      if (s) { e.preventDefault(); go(s.getAttribute('data-kind') === 'rental' ? 'tab14' : 'tab13'); var a = apps[s.getAttribute('data-kind') === 'rental' ? 'rental' : 'service']; if (a) a.setGroup(s.getAttribute('data-svc-group'), s.getAttribute('data-svc-type')); }
    });
    document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-svc-group], [role="button"][data-tab]')) { e.preventDefault(); e.target.click(); } });
    var active = document.querySelector('.tab-content.active'); if (active) syncNav(active.id || 'tab1'); else syncNav('tab1');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
