/* CUDWEARS core: Supabase data, market grid, product sheet (colours, sizes, modifications, measurements),
   cart + checkout, order tracking, size guide, help form. Runs inside the CUDMAZE-style shell. */
(function () {
  'use strict';

  var sb = window.supabase.createClient(CFG.url, CFG.key);
  var WA = CFG.wa;
  var $ = function (s) { return document.querySelector(s); };
  var naira = function (n) { return '\u20A6' + Number(n || 0).toLocaleString('en-NG'); };
  var LS = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var toast = function (m) { if (typeof showToast === 'function') showToast(m, 2400); else CW.toast(m); };
  var copy = CW.copy;
  function E(t, a, k) {
    var n = document.createElement(t); a = a || {};
    Object.keys(a).forEach(function (x) {
      var v = a[x];
      if (x === 'text') n.textContent = v;
      else if (x.slice(0, 2) === 'on') n.addEventListener(x.slice(2), v);
      else if (v === true) n.setAttribute(x, '');
      else if (v !== false && v != null) n.setAttribute(x, v);
    });
    [].concat(k || []).flat(9).forEach(function (c) { if (c != null && c !== false) n.append(c); });
    return n;
  }
  var ico = function (n) { return E('i', { class: 'bi bi-' + n, 'aria-hidden': 'true' }); };
  var img = function (id) { return CFG.url + '/storage/v1/object/public/products/' + id; };

  /* ---------------- state ---------------- */
  var P = [], LST = [], S = { deposit_pct: 60, methods: [], lead_default: '4-6 working days', delivery_info: '' };
  var wish = LS.get('cw_wish', []), cart = LS.get('cw_cart', []);
  var F = { cat: '', kind: '', seller: '', sort: 'new', q: '' };
  var readyRes; var ready = new Promise(function (r) { readyRes = r; });
  var CATS = CW.CATS;
  var dataCbs = [];
  window.CWX = {
    sb: sb, CFG: CFG, ready: ready, E: E, ico: ico, naira: naira, LS: LS, copy: copy, toast: toast,
    get products() { return P; }, get listings() { return LST; },
    onData: function (fn) { if (P.length || LST.length || window.CWX._loaded) fn(); else dataCbs.push(fn); },
    openProduct: function (id) { var p = P.filter(function (x) { return x.id === id; })[0]; if (p) openP(p); },
    filter: applyFilter, go: go
  };

  function go(tab) { if (typeof openTab === 'function') openTab(null, tab); var m = document.querySelector('.content-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); }

  /* ---------------- overlays (CUDMAZE pm-overlay look) ---------------- */
  var openStack = [];
  function ov(id) { return document.getElementById(id); }
  function openOv(id, nodes) {
    var o = ov(id), body = o.querySelector('.pm-scroll');
    body.replaceChildren.apply(body, [].concat(nodes).flat(9).filter(Boolean));
    o.classList.add('visible'); o.setAttribute('aria-hidden', 'false'); body.scrollTop = 0;
    if (openStack.indexOf(id) < 0) openStack.push(id);
    document.body.style.overflow = 'hidden';
  }
  function closeOv(id) {
    var o = ov(id); if (!o) return;
    o.classList.remove('visible'); o.setAttribute('aria-hidden', 'true');
    openStack = openStack.filter(function (x) { return x !== id; });
    if (!openStack.length) document.body.style.overflow = '';
    if (id === 'productModal' && /^#p=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  ['productModal', 'cartModal', 'orderModal'].forEach(function (id) {
    var o = ov(id);
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-close]')) closeOv(id); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openStack.length) closeOv(openStack[openStack.length - 1]); });

  /* ---------------- data ---------------- */
  var p1 = sb.from('settings').select('*').eq('id', 1).maybeSingle().then(function (r) {
    var d = r.data; if (d) S = { deposit_pct: d.deposit_pct == null ? 60 : d.deposit_pct, methods: d.methods || [], lead_default: d.lead_default || S.lead_default, delivery_info: d.delivery_info || '' };
  }).catch(function () {});
  var p2 = sb.from('products').select('*').eq('active', true).order('created_at', { ascending: false }).then(function (r) {
    P = (r.data || []).map(function (p) {
      return Object.assign({}, p, { desc: p.descr || '', kind: p.kind || '', seller: p.seller || '', featured: !!p.featured, sizes: p.sizes || [], mods: p.mods || [], imgs: p.imgs || [] });
    });
  }).catch(function () {});
  var p3 = sb.from('listings').select('*').eq('status', 'approved').order('created_at', { ascending: false }).then(function (r) { LST = r.data || []; }).catch(function () {});
  Promise.all([p1, p2, p3]).then(function () {
    window.CWX._loaded = true;
    renderAll(); readyRes();
    dataCbs.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
    var m = location.hash.match(/^#p=([\w-]+)/); if (m) window.CWX.openProduct(m[1]);
  });

  /* ---------------- product cards (CUDMAZE list-item look) ---------------- */
  var heartTxt = function (id) { return wish.indexOf(id) > -1 ? '\u2665' : '\u2661'; };
  function toggleWish(id) {
    wish = wish.indexOf(id) > -1 ? wish.filter(function (x) { return x !== id; }) : wish.concat(id);
    LS.set('cw_wish', wish);
    document.querySelectorAll('.cw-heart[data-id="' + id + '"]').forEach(function (b) { b.textContent = heartTxt(id); b.classList.toggle('on', wish.indexOf(id) > -1); });
    renderLists();
  }
  function thumb(p, cls) {
    return p.imgs[0] ? E('img', { class: cls || 'product-thumb', src: img(p.imgs[0]), alt: p.name, width: 600, height: 240, loading: 'lazy', decoding: 'async' })
      : E('div', { class: (cls || 'product-thumb') + ' cw-noimg' }, [ico('handbag')]);
  }
  function card(p) {
    var open = function () { openP(p); };
    var search = [p.name, p.desc, p.kind, p.sub, p.seller, CATS[p.cat]].join(' ');
    var it = E('div', { class: 'list-item cw-card', 'data-product-id': p.id, 'data-cat': p.cat, 'data-price': p.price, 'data-search-text': search, role: 'button', tabindex: '0', 'aria-label': p.name, onclick: open,
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } }, [
      E('div', { class: 'cw-imgwrap' }, [thumb(p),
        E('button', { type: 'button', class: 'cw-heart' + (wish.indexOf(p.id) > -1 ? ' on' : ''), 'data-id': p.id, 'aria-label': 'Save design', text: heartTxt(p.id), onclick: function (e) { e.stopPropagation(); toggleWish(p.id); } })]),
      E('div', { class: 'item-icon', text: p.name }),
      E('div', { class: 'item-content d-flex justify-content-between align-items-center' }, [
        E('h6', { text: p.desc || p.kind || CATS[p.cat] }),
        E('button', { type: 'button', class: 'btn btn-success', 'data-product-open': '', text: 'Order', onclick: function (e) { e.stopPropagation(); open(); } })]),
      E('div', { class: 'product-price', text: naira(p.price) }),
      E('p', {}, [p.seller ? p.seller + ' \u00B7 ' : '', E('span', { class: 'tag green', text: '#' + (p.kind || CATS[p.cat]) }), ' ', E('span', { class: 'tag gray', text: p.lead || S.lead_default })])
    ]);
    return it;
  }
  function railCard(p) {
    return E('button', { type: 'button', class: 'cw-rcard', 'aria-label': p.name, onclick: function () { openP(p); } }, [
      p.imgs[0] ? E('img', { src: img(p.imgs[0]), alt: '', loading: 'lazy', decoding: 'async' }) : E('div', { class: 'cw-noimg' }, [ico('handbag')]),
      E('b', { text: p.name }), E('span', { text: naira(p.price) })]);
  }

  /* ---------------- market tab ---------------- */
  function filtered() {
    var q = F.q.toLowerCase().trim();
    var L = P.filter(function (p) {
      if (F.cat === 'saved') { if (wish.indexOf(p.id) < 0) return false; } else if (F.cat && p.cat !== F.cat) return false;
      if (F.kind && (p.kind || p.sub) !== F.kind) return false;
      if (F.seller && p.seller !== F.seller) return false;
      if (q && [p.name, p.desc, p.kind, p.sub, p.seller].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (F.sort === 'low') L.sort(function (a, b) { return a.price - b.price; });
    if (F.sort === 'high') L.sort(function (a, b) { return b.price - a.price; });
    if (F.sort === 'az') L.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return L;
  }
  function drawToolbar() {
    var host = $('#shopToolbar'); if (!host) return;
    var cats = [['', 'All']].concat(Object.keys(CATS).filter(function (k) { return P.some(function (p) { return p.cat === k; }); }).map(function (k) { return [k, CATS[k]]; }), [['saved', '\u2665 Saved']]);
    var row = E('div', { class: 'chip-row', role: 'tablist', 'aria-label': 'Categories' }, cats.map(function (c) {
      return E('button', { type: 'button', class: 'chip' + (F.cat === c[0] ? ' active' : ''), text: c[1], onclick: function () { F.cat = c[0]; F.kind = ''; F.seller = ''; renderMarket(); } });
    }));
    var kinds = []; P.forEach(function (p) { var k = p.kind || p.sub; if (k && (!F.cat || F.cat === 'saved' || p.cat === F.cat) && kinds.indexOf(k) < 0) kinds.push(k); });
    var sub = kinds.length > 1 ? E('div', { class: 'chip-row' }, [E('button', { type: 'button', class: 'chip sub' + (!F.kind ? ' active' : ''), text: 'Everything', onclick: function () { F.kind = ''; renderMarket(); } })].concat(kinds.map(function (k) {
      return E('button', { type: 'button', class: 'chip sub' + (F.kind === k ? ' active' : ''), text: k, onclick: function () { F.kind = k; renderMarket(); } });
    }))) : null;
    var sel = E('select', { class: 'hub-select', 'aria-label': 'Sort designs', onchange: function () { F.sort = this.value; renderMarket(); } },
      [['new', 'Newest'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['az', 'Name A to Z']].map(function (o) { return E('option', { value: o[0], text: o[1], selected: F.sort === o[0] }); }));
    host.replaceChildren(row, sub, E('div', { class: 'cw-sortrow' }, [E('span', { class: 'pm-hint', id: 'shopCount' }), F.seller ? E('button', { type: 'button', class: 'chip sub active', text: F.seller + ' \u2715', onclick: function () { F.seller = ''; renderMarket(); } }) : null, sel]));
  }
  function renderMarket() {
    drawToolbar();
    var L = filtered(), host = $('#serviceList'), empty = $('#shopEmpty');
    host.replaceChildren.apply(host, L.map(card));
    $('#shopCount').textContent = L.length + (L.length === 1 ? ' design' : ' designs');
    empty.hidden = !!L.length;
    if (!L.length && !P.length) empty.firstChild.textContent = 'New designs are landing soon. Check back shortly. ';
  }
  function applyFilter(v) {
    v = String(v || '').trim(); F = { cat: '', kind: '', seller: '', sort: F.sort, q: '' };
    var lv = v.toLowerCase();
    var catKey = Object.keys(CATS).filter(function (k) { return k === lv || CATS[k].toLowerCase() === lv; })[0];
    if (catKey) F.cat = catKey;
    else if (v) {
      var kind = P.filter(function (p) { return (p.kind || '').toLowerCase() === lv; })[0];
      var seller = P.filter(function (p) { return (p.seller || '').toLowerCase() === lv; })[0];
      if (kind) { F.kind = kind.kind; F.cat = kind.cat; } else if (seller) F.seller = seller.seller; else F.q = v;
    }
    var si = document.querySelector('#tab3 .view-search'); if (si) si.value = F.q;
    renderMarket(); go('tab3');
  }

  /* ---------------- home / lists / sellers / categories ---------------- */
  var CAT_ICO = { clothing: 'bi-bag-heart', footwear: 'bi-box2-heart', accessories: 'bi-house-heart' };
  function renderHome() {
    var hc = $('#homeCats');
    if (hc) {
      var chipsH = [E('button', { type: 'button', class: 'chip active', 'data-filter': '', role: 'listitem' }, [ico('grid'), ' All'])];
      Object.keys(CATS).forEach(function (k) { chipsH.push(E('button', { type: 'button', class: 'chip', 'data-filter': k, role: 'listitem' }, [ico((CAT_ICO[k] || 'bi-bag').slice(3)), ' ' + CATS[k]])); });
      chipsH.push(E('button', { type: 'button', class: 'chip', 'data-filter': 'saved', role: 'listitem' }, [ico('heart'), ' Saved']));
      hc.replaceChildren.apply(hc, chipsH);
    }
    var rec = P.filter(function (p) { return p.featured; }), R = (rec.length ? rec : P).slice(0, 8), hf = $('#homeFeatured');
    if (hf) hf.replaceChildren.apply(hf, R.length ? R.map(railCard) : [E('p', { class: 'note-empty', text: 'New designs are landing soon.' })]);
    initRail();
  }
  /* sliding rail: arrows, edge fades, progress bar, and a one-time nudge so people see it moves */
  var railInit = false;
  function initRail() {
    var rail = $('#homeFeatured'), wrap = $('#railWrap'), bar = $('#railBar'); if (!rail || !wrap) return;
    var prev = wrap.querySelector('.prev'), next = wrap.querySelector('.next'), hint = document.querySelector('.cw-swipehint');
    function upd() {
      var max = rail.scrollWidth - rail.clientWidth, can = max > 6, x = rail.scrollLeft;
      prev.hidden = !can || x < 6; next.hidden = !can || x > max - 6;
      wrap.classList.toggle('more-l', can && x > 6); wrap.classList.toggle('more-r', can && x < max - 6);
      if (hint) hint.hidden = !can;
      bar.hidden = !can; if (can) bar.firstChild.style.cssText = 'width:' + Math.max(18, rail.clientWidth / rail.scrollWidth * 100) + '%;margin-left:' + (x / max) * (100 - Math.max(18, rail.clientWidth / rail.scrollWidth * 100)) + '%';
    }
    if (!railInit) {
      railInit = true;
      rail.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd);
      prev.addEventListener('click', function () { rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: 'smooth' }); });
      next.addEventListener('click', function () { rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: 'smooth' }); });
      if ('IntersectionObserver' in window) {
        var seen = false;
        new IntersectionObserver(function (en) {
          if (seen || !en[0].isIntersecting) return; seen = true;
          if (rail.scrollWidth - rail.clientWidth < 20) return;
          setTimeout(function () { rail.scrollTo({ left: 70, behavior: 'smooth' }); setTimeout(function () { rail.scrollTo({ left: 0, behavior: 'smooth' }); }, 650); }, 500);
        }, { threshold: 0.6 }).observe(wrap);
      }
    }
    upd(); setTimeout(upd, 400);
  }
  function renderLists() {
    var map = { listFeat: function () { var r = P.filter(function (p) { return p.featured; }); return r.length ? r : P.slice(0, 12); }, listNew: function () { return P.slice(0, 24); }, listSaved: function () { return P.filter(function (p) { return wish.indexOf(p.id) > -1; }); } };
    Object.keys(map).forEach(function (id) {
      var h = document.getElementById(id); if (!h) return; var L = map[id]();
      h.replaceChildren.apply(h, L.length ? L.map(card) : [E('div', { class: 'alert alert-secondary m-1', text: id === 'listSaved' ? 'Tap the heart on a design to save it here.' : 'Nothing here yet.' })]);
    });
  }
  function stores() { return LST.filter(function (l) { return l.kind === 'store'; }); }
  function designerRow(l) {
    var n = P.filter(function (p) { return p.seller === l.name; }).length;
    return E('div', { class: 'list-item', 'data-search-text': [l.name, l.city, l.state, l.descr, l.grp].join(' ') }, [
      E('div', { class: 'item-icon', text: l.name }),
      E('div', { class: 'item-content d-flex justify-content-between align-items-center' }, [E('h6', { text: l.descr }),
        n ? E('button', { type: 'button', class: 'btn btn-success', text: 'See Designs', onclick: function () { applyFilter(l.name); } })
          : E('button', { type: 'button', class: 'btn btn-ghost', text: 'Message', onclick: function () { openWA(l.phone || WA, 'Hello, I found ' + l.name + ' on CUDWEARS and would like to ask about your designs.'); } })]),
      E('p', {}, [l.city + (l.state ? ', ' + l.state : '') + ' \u00B7 ', l.reviews ? E('span', { class: 'tag green', text: '\u2605 ' + l.rating }) : null, ' ', E('span', { class: 'tag gray', text: n + (n === 1 ? ' design' : ' designs') }), ' ', l.verified ? E('span', { class: 'tag orange', text: 'Verified' }) : null, l.sample ? E('span', { class: 'tag gray', text: 'Sample' }) : null])]);
  }
  function renderSellers() {
    var sl = $('#sellerList'), hd = $('#homeDesigners'), S2 = stores();
    var rows = S2.map(designerRow);
    if (sl) sl.replaceChildren.apply(sl, rows.length ? rows : [E('div', { class: 'alert alert-secondary', text: 'Designers will appear here once they are approved.' })]);
    if (hd) hd.replaceChildren.apply(hd, S2.slice(0, 3).map(designerRow));
  }
  function renderAll() { renderHome(); renderMarket(); renderLists(); renderSellers(); renderInfo(); updateCartBadge(); }

  /* ---------------- delivery + payment info (from Admin > Settings) ---------------- */
  function renderInfo() {
    var d = $('#deliveryInfo'), p = $('#payInfo');
    if (d) d.replaceChildren(E('p', { class: 'mb-1' }, [ico('truck'), ' Estimated delivery: ', E('b', { text: S.lead_default }), ' after your deposit is confirmed.']), S.delivery_info ? E('div', { class: 'cw-pre', text: S.delivery_info }) : null);
    if (p) p.replaceChildren(E('p', { class: 'mb-1', text: S.deposit_pct + '% deposit starts your order (materials and dye). The balance is paid before or on delivery. Pay by:' }),
      E('ul', { class: 'mb-0' }, (S.methods.length ? S.methods : [{ label: 'Bank transfer' }]).map(function (m) { return E('li', { text: m.label + (m.bank ? ' (' + m.bank + ')' : '') }); })));
  }

  /* ---------------- WhatsApp helper ---------------- */
  function openWA(num, text) {
    var url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(text), w = null;
    try { w = window.open(url, '_blank'); } catch (e) {}
    if (!w) location.href = url;
  }
  window.CWX.openWA = openWA;

  /* ---------------- product sheet ---------------- */
  var FIELDS = { clothing: ['Chest / Bust', 'Waist', 'Hip', 'Length', 'Shoulder', 'Sleeve'], footwear: ['Foot length (cm)', 'Foot width'], accessories: ['Length', 'Width', 'Height'] };
  function chips(list, get, set) {
    var box = E('div', { class: 'cw-chips' });
    var draw = function () { box.replaceChildren.apply(box, list.map(function (v) { return E('button', { type: 'button', class: 'cw-opt' + (get(v) ? ' on' : ''), text: v, onclick: function () { set(v); draw(); } }); })); };
    draw(); return box;
  }
  function openP(p) {
    history.replaceState(null, '', '#p=' + p.id);
    var meas0 = LS.get('cw_meas', {}), lead = p.lead || S.lead_default, mk = FIELDS[p.cat] || FIELDS.clothing;
    var blank = function (src) { return { cols: src ? src.cols.map(function (c) { return Object.assign({}, c); }) : [], size: src ? src.size : '', mods: new Set(src ? Array.from(src.mods) : []), note: src ? src.note : '', meas: src ? Object.assign({}, src.meas) : Object.assign({}, meas0) }; };
    var s = { copies: [blank()], cur: 0, prev: null, imgI: 0 }, C = function () { return s.copies[s.cur]; };
    var main = E('div', { class: 'cw-mainimg' }, [p.imgs[0] ? E('img', { src: img(p.imgs[0]), alt: p.name }) : E('div', { class: 'cw-noimg big' }, [ico('handbag')])]);
    var pvnote = E('div', { class: 'cw-pvnote' });
    var thumbs = p.imgs.length > 1 ? E('div', { class: 'cw-thumbs' }, p.imgs.map(function (id, i) {
      return E('img', { src: img(id), alt: 'View ' + (i + 1), class: i ? '' : 'on', onclick: function (e) { s.imgI = i; thumbs.querySelectorAll('img').forEach(function (x) { x.classList.remove('on'); }); e.target.classList.add('on'); showPrev(); } });
    })) : null;
    function showPrev() {
      if (!p.imgs.length) return;
      var im = main.firstChild, orig = img(p.imgs[s.imgI]), c = C().cols[s.prev];
      if (!c) { im.src = orig; pvnote.textContent = C().cols.length ? 'Tap a chosen colour to preview it on the photo.' : ''; return; }
      pvnote.textContent = 'Preparing preview\u2026';
      CW.recolor(orig, c.hex).then(function (u) { if (C().cols[s.prev] === c) { im.src = u; pvnote.textContent = 'Previewing ' + c.name + ' on Item ' + (s.cur + 1) + '. A guide only, the final dye may vary slightly.'; } })
        .catch(function () { im.src = orig; pvnote.textContent = 'Preview is not available for this photo.'; });
    }
    var tabs = E('div', { class: 'cw-chips' }), editor = E('div');
    function drawTabs() { tabs.replaceChildren.apply(tabs, s.copies.length > 1 ? s.copies.map(function (_, i) { return E('button', { type: 'button', class: 'cw-opt' + (i === s.cur ? ' on' : ''), text: 'Item ' + (i + 1), onclick: function () { s.cur = i; s.prev = C().cols.length ? 0 : null; drawTabs(); drawEditor(); showPrev(); } }); }) : []); }
    function drawEditor() {
      var c = C(), grid = E('div', { class: 'cw-sws' }), sel = E('div', { class: 'cw-selcols' }), has = function (n) { return c.cols.some(function (x) { return x.name === n; }); };
      function addCol(x) { if (has(x.name)) return; if (c.cols.length >= 6) { toast('Up to 6 colours'); return; } c.cols.push(x); s.prev = c.cols.length - 1; drawC(); showPrev(); }
      function drawC() {
        grid.replaceChildren.apply(grid, CW.COLORS.map(function (cc) {
          var n = cc[0], h = cc[1];
          return E('button', { type: 'button', class: 'cw-sw' + (has(n) ? ' on' : ''), title: n, onclick: function () {
            if (has(n)) { c.cols.splice(c.cols.findIndex(function (x) { return x.name === n; }), 1); s.prev = c.cols.length ? Math.min(s.prev == null ? 0 : s.prev, c.cols.length - 1) : null; drawC(); showPrev(); } else addCol({ name: n, hex: h });
          } }, [E('i', { class: 'cw-dot', style: 'background:' + h }), E('span', { text: n })]);
        }));
        sel.replaceChildren.apply(sel, c.cols.map(function (x, i) {
          return E('span', { class: 'cw-selc' + (s.prev === i ? ' pv' : '') }, [
            E('button', { type: 'button', onclick: function () { s.prev = s.prev === i ? null : i; drawC(); showPrev(); } }, [E('i', { class: 'cw-dot', style: 'background:' + x.hex }), x.name]),
            E('button', { type: 'button', 'aria-label': 'Remove ' + x.name, text: '\u00D7', onclick: function () { c.cols.splice(i, 1); s.prev = c.cols.length ? 0 : null; drawC(); showPrev(); money(); } })]);
        }));
        money();
      }
      var custom = E('input', { type: 'color', value: '#465f9f', 'aria-label': 'Pick any other colour', class: 'cw-picker', onchange: function (e) { addCol({ name: CW.nearest(e.target.value) + ' (custom ' + e.target.value.toUpperCase() + ')', hex: e.target.value }); } });
      drawC();
      var mi = mk.map(function (k) { return E('input', { class: 'form-control', placeholder: k, 'aria-label': k, value: c.meas[k] || '', oninput: function (e) { c.meas[k] = e.target.value; } }); });
      var note = E('textarea', { class: 'form-control', rows: 2, placeholder: 'e.g. "wine for the body, gold trim", fabric choice\u2026', oninput: function (e) { c.note = e.target.value; } }); note.value = c.note;
      var parts = [E('div', { class: 'cw-lbl', text: 'Item ' + (s.cur + 1) + (s.copies.length > 1 ? ' of ' + s.copies.length : '') + ': colours (any you like, up to 6)' }), grid,
        E('div', { class: 'cw-row' }, [custom, E('span', { class: 'pm-hint', text: 'Pick any other colour' })]), sel];
      if (p.sizes.length) parts.push(E('div', { class: 'cw-lbl', text: 'Size' }), chips(p.sizes, function (v) { return c.size === v; }, function (v) { c.size = v; money(); }));
      parts.push(E('details', { class: 'cw-dd' }, [E('summary', { text: 'My measurements (optional)' }), E('div', { class: 'cw-in' }, [E('p', { class: 'pm-hint', text: 'Saved on this phone for next time.' }), E('div', { class: 'cw-two' }, mi)])]));
      if (p.mods.length) parts.push(E('div', { class: 'cw-lbl', text: 'Modifications (optional)' }), chips(p.mods, function (v) { return c.mods.has(v); }, function (v) { if (c.mods.has(v)) c.mods.delete(v); else c.mods.add(v); money(); }));
      parts.push(E('div', { class: 'cw-lbl', text: 'Anything else you want changed?' }), note);
      if (s.cur > 0) parts.push(E('button', { type: 'button', class: 'cw-opt', style: 'margin-top:10px', text: 'Copy choices from Item 1', onclick: function () { s.copies[s.cur] = blank(s.copies[0]); s.prev = null; drawEditor(); showPrev(); money(); } }));
      editor.replaceChildren.apply(editor, parts);
    }
    var qv = E('span', { class: 'cw-qv' }), sum = E('div', { class: 'cw-sum' }), err = E('div', { class: 'pm-error', hidden: true, role: 'alert' });
    function money() {
      var n = s.copies.length, t = p.price * n; qv.textContent = n;
      sum.replaceChildren.apply(sum, s.copies.map(function (c, i) {
        return E('div', { class: 'cw-li pm-hint' }, [E('span', { text: 'Item ' + (i + 1) + ': ' + ([c.size, c.cols.map(function (x) { return x.name.replace(/ \(custom.*/, ''); }).join(', '), c.mods.size ? c.mods.size + ' modification' + (c.mods.size > 1 ? 's' : '') : ''].filter(Boolean).join(' \u00B7 ') || 'as in photo') }), E('span', { text: naira(p.price) })]);
      }).concat([E('hr'), E('div', { class: 'cw-li' }, [E('b', { text: 'Total (' + n + ' item' + (n > 1 ? 's' : '') + ')' }), E('b', { text: naira(t) })]),
        E('div', { class: 'cw-li pm-hint' }, [E('span', { text: S.deposit_pct + '% deposit to start (materials and dye)' }), E('b', { text: naira(Math.ceil(t * S.deposit_pct / 100)) })])]));
    }
    function setQty(n) {
      n = Math.max(1, Math.min(10, n));
      while (s.copies.length < n) s.copies.push(blank(s.copies[s.copies.length - 1]));
      while (s.copies.length > n) s.copies.pop();
      if (s.cur >= n) s.cur = n - 1; if (s.prev != null && !C().cols[s.prev]) s.prev = null;
      drawTabs(); drawEditor(); money(); showPrev();
    }
    function fail(m) { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    function lines() {
      var N = s.copies.length, mt = function (c) { return mk.map(function (k) { return c.meas[k] && String(c.meas[k]).trim() ? k + ' ' + String(c.meas[k]).trim() : ''; }).filter(Boolean); };
      for (var i = 0; i < N; i++) if (p.sizes.length && !s.copies[i].size) { s.cur = i; s.prev = null; drawTabs(); drawEditor(); showPrev(); fail('Item ' + (i + 1) + ': choose a size (or enter measurements and pick the closest size).'); return null; }
      LS.set('cw_meas', s.copies[0].meas);
      return s.copies.map(function (c, i) {
        return { pid: p.id, name: p.name, price: p.price, img: p.imgs[0] || '', qty: 1, colours: c.cols, size: c.size, mods: Array.from(c.mods),
          note: [N > 1 ? 'Item ' + (i + 1) + ' of ' + N : '', c.note.trim(), mt(c).length ? 'Measurements: ' + mt(c).join(', ') : ''].filter(Boolean).join('\n') };
      });
    }
    var addBtn = E('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { err.hidden = true; var ls = lines(); if (!ls) return; if (cart.length + ls.length > 10) { fail('A single order holds up to 10 items. Check out your cart first, then add more.'); return; } cart = cart.concat(ls); saveCart(); closeOv('productModal'); toast(ls.length + (ls.length > 1 ? ' items' : ' item') + ' added to cart'); } }, [ico('bag-plus'), ' Add to cart']);
    var buyBtn = E('button', { type: 'button', class: 'btn btn-success', onclick: function () { err.hidden = true; var ls = lines(); if (!ls) return; if (cart.length + ls.length > 10) { fail('A single order holds up to 10 items. Check out your cart first, then add more.'); return; } cart = cart.concat(ls); saveCart(); closeOv('productModal'); openCart(); } }, [ico('bag-check'), ' Order now']);
    var saveBtn = E('button', { type: 'button', class: 'btn btn-ghost', text: wish.indexOf(p.id) > -1 ? '\u2665 Saved' : '\u2661 Save', onclick: function (e) { toggleWish(p.id); e.currentTarget.textContent = wish.indexOf(p.id) > -1 ? '\u2665 Saved' : '\u2661 Save'; } });
    var shareBtn = E('button', { type: 'button', class: 'btn btn-ghost', text: 'Share', onclick: function () { var url = location.origin + '/p/' + p.id; if (navigator.share) navigator.share({ title: p.name + ' | CUDWEARS', text: p.name + ' on CUDWEARS', url: url }).catch(function () {}); else copy(url, 'Link copied'); } });
    var askBtn = E('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { openWA(WA, 'Hello CUDWEARS, I have a question about ' + p.name + ' (' + location.origin + '/p/' + p.id + ').'); } }, [ico('whatsapp'), ' Ask']);
    drawTabs(); drawEditor(); money();
    openOv('productModal', [main, thumbs, pvnote, E('h2', { text: p.name, class: 'mt-2' }), E('div', { class: 'product-price', style: 'font-size:1.15rem', text: naira(p.price) }), p.seller ? E('p', { class: 'pm-hint' }, ['Sold by ', E('a', { href: '#', text: p.seller, onclick: function (e) { e.preventDefault(); closeOv('productModal'); applyFilter(p.seller); } })]) : null, p.desc ? E('p', { class: 'pm-desc', text: p.desc }) : null,
      E('div', { class: 'cw-info' }, [ico('truck'), ' Estimated delivery: ', E('b', { text: lead })]),
      E('div', { class: 'cw-lbl', text: 'How many?' }), E('div', { class: 'cw-row' }, [E('div', { class: 'pm-qty' }, [E('button', { type: 'button', 'aria-label': 'Fewer', text: '\u2212', onclick: function () { setQty(s.copies.length - 1); } }), qv, E('button', { type: 'button', 'aria-label': 'More', text: '+', onclick: function () { setQty(s.copies.length + 1); } })]), E('span', { class: 'pm-hint', text: 'Each item can have its own size, colours and modifications.' })]),
      tabs, editor, sum, err, E('div', { class: 'cw-actions' }, [buyBtn, addBtn]), E('div', { class: 'cw-actions two' }, [saveBtn, shareBtn, askBtn])]);
  }

  /* ---------------- cart + checkout ---------------- */
  function saveCart() { LS.set('cw_cart', cart); updateCartBadge(); }
  function updateCartBadge() { var b = $('#cartCount'); if (!b) return; b.textContent = cart.length; b.hidden = !cart.length; }
  function payCard(m, amt) {
    var row = function (l, v, c) { return E('div', { class: 'cw-rw' }, [E('div', {}, [E('small', { text: l }), E('b', { text: v })]), c != null ? E('button', { type: 'button', class: 'cw-opt', text: 'Copy', onclick: function () { copy(c, l + ' copied'); } }) : null]); };
    if (!(m && (m.account || m.bank || m.name || m.details || m.link))) return E('div', { class: 'cw-info', text: 'We will send you the payment details on WhatsApp.' });
    var all = [m.label, m.bank && 'Bank: ' + m.bank, m.account && 'Account number: ' + m.account, m.name && 'Account name: ' + m.name, 'Amount: ' + naira(amt)].filter(Boolean).join('\n'), link = /^https?:\/\//i.test(m.link || '') ? m.link : '';
    return E('div', { class: 'cw-paycard' }, [E('b', { text: 'Pay with ' + m.label }), m.bank ? row('Bank / app', m.bank) : null, m.account ? row('Account number', m.account, m.account.replace(/\s/g, '')) : null, m.name ? row('Account name', m.name, m.name) : null, row('Deposit to pay', naira(amt), String(amt)),
      m.details ? E('div', { class: 'cw-pre', text: m.details }) : null,
      E('div', { class: 'cw-row' }, [link ? E('a', { class: 'btn btn-success', href: link, target: '_blank', rel: 'noopener', text: 'Pay with ' + m.label + ' now' }) : null, E('button', { type: 'button', class: 'cw-opt', text: 'Copy all details', onclick: function () { copy(all, 'Payment details copied'); } })])]);
  }
  function openCart() {
    var me = LS.get('cw_me', {}), loc = null, pay = (S.methods[0] || {}).label || '';
    if (!cart.length) { openOv('cartModal', [E('h2', { text: 'My cart' }), E('p', { class: 'pm-note', text: 'Your cart is empty. Pick a design and tap Add to cart.' }), E('button', { type: 'button', class: 'btn btn-success', text: 'Browse designs', onclick: function () { closeOv('cartModal'); go('tab3'); } })]); return; }
    var f = { n: E('input', { class: 'form-control', placeholder: 'Your name', autocomplete: 'name', value: me.n || '' }), ph: E('input', { class: 'form-control', type: 'tel', placeholder: 'Phone / WhatsApp', autocomplete: 'tel', value: me.ph || '' }), em: E('input', { class: 'form-control', type: 'email', placeholder: 'Email (optional)', autocomplete: 'email', value: me.em || '' }), ad: E('textarea', { class: 'form-control', rows: 2, placeholder: 'House number, street, area, city, state (optional)' }) };
    f.ad.value = me.ad || '';
    var locNote = E('div', { class: 'pm-hint' });
    var locBtn = E('button', { type: 'button', class: 'cw-opt', text: '\uD83D\uDCCD Use my location', onclick: function () {
      if (!navigator.geolocation) { locNote.textContent = 'Location is not available on this device.'; return; }
      locNote.textContent = 'Finding you\u2026';
      navigator.geolocation.getCurrentPosition(function (r) { loc = { lat: +r.coords.latitude.toFixed(6), lng: +r.coords.longitude.toFixed(6) }; locNote.replaceChildren('Location saved \u2713 ', E('a', { href: 'https://www.google.com/maps?q=' + loc.lat + ',' + loc.lng, target: '_blank', rel: 'noopener', text: 'View on Google Maps' })); }, function () { locNote.textContent = 'We could not get your location. You can type your address instead.'; }, { enableHighAccuracy: true, timeout: 12000 });
    } });
    var addr = E('details', { class: 'cw-dd' }, [E('summary', { text: 'Add delivery address (optional)' }), E('div', { class: 'cw-in' }, [E('p', { class: 'pm-hint', text: 'You can skip this. If you do, we will ask for delivery details on WhatsApp.' }), f.ad, E('div', { class: 'cw-row' }, [locBtn, E('a', { class: 'cw-opt', href: 'https://www.google.com/maps', target: '_blank', rel: 'noopener', text: '\uD83D\uDDFA Open Google Maps' })]), locNote])]);
    if (f.ad.value) addr.open = true;
    var listBox = E('div'), sum = E('div', { class: 'cw-sum' }), err = E('div', { class: 'pm-error', hidden: true, role: 'alert' });
    var go2 = E('button', { type: 'button', class: 'btn btn-success', text: 'Place order' });
    function draw() {
      listBox.replaceChildren.apply(listBox, cart.map(function (it, i) {
        return E('div', { class: 'cw-cartline' }, [it.img ? E('img', { src: img(it.img), alt: '' }) : E('div', { class: 'cw-noimg' }, [ico('handbag')]),
          E('div', {}, [E('b', { text: it.name }), E('div', { class: 'pm-hint', text: [it.size, (it.colours || []).map(function (c) { return c.name.replace(/ \(custom.*/, ''); }).join(', '), (it.mods || []).length ? it.mods.length + ' mod' + (it.mods.length > 1 ? 's' : '') : ''].filter(Boolean).join(' \u00B7 ') || 'as in photo' }), E('div', { class: 'product-price', text: naira(it.price) })]),
          E('button', { type: 'button', class: 'cw-x', 'aria-label': 'Remove ' + it.name, text: '\u00D7', onclick: function () { cart.splice(i, 1); saveCart(); if (!cart.length) openCart(); else draw(); } })]);
      }));
      var t = cart.reduce(function (a, x) { return a + x.price; }, 0), d = Math.ceil(t * S.deposit_pct / 100);
      sum.replaceChildren(E('div', { class: 'cw-li' }, [E('b', { text: 'Total (' + cart.length + ' item' + (cart.length > 1 ? 's' : '') + ')' }), E('b', { text: naira(t) })]), E('div', { class: 'cw-li pm-hint' }, [E('span', { text: S.deposit_pct + '% deposit to start (materials and dye)' }), E('b', { text: naira(d) })]), E('div', { class: 'cw-li pm-hint' }, [E('span', { text: 'Balance before / on delivery' }), E('span', { text: naira(t - d) })]));
    }
    var payBox = S.methods.length ? E('div', {}, [E('div', { class: 'cw-lbl', text: 'How would you like to pay your deposit?' }), chips(S.methods.map(function (m) { return m.label; }), function (v) { return pay === v; }, function (v) { pay = v; }), E('p', { class: 'pm-hint', text: 'No online payment is forced. Pay by bank transfer or the app you prefer, then send us your receipt on WhatsApp.' })]) : null;
    draw();
    go2.onclick = function () {
      err.hidden = true;
      var items = cart.map(function (it) { return { pid: it.pid, qty: 1, colours: it.colours, size: it.size, mods: it.mods, note: it.note }; });
      go2.disabled = true; go2.textContent = 'Sending\u2026';
      sb.rpc('place_order', { p_type: 'order', p_name: f.n.value, p_phone: f.ph.value || '', p_email: f.em.value || '', p_address: f.ad.value || '', p_lat: loc ? loc.lat : null, p_lng: loc ? loc.lng : null, p_pay: pay || '', p_note: '', p_items: items }).then(function (r) {
        go2.disabled = false; go2.textContent = 'Place order';
        if (r.error) { err.textContent = r.error.message; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        var d = r.data;
        LS.set('cw_me', { n: f.n.value.trim(), ph: f.ph.value.trim(), em: f.em.value.trim(), ad: f.ad.value.trim() });
        var names = cart.map(function (x) { return x.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
        var list = LS.get('cw_orders', []); list.unshift({ code: d.code, contact: f.ph.value.trim() || f.em.value.trim(), name: names, at: Date.now() }); LS.set('cw_orders', list.slice(0, 30));
        cart = []; saveCart(); closeOv('cartModal'); renderMine(); done(d, pay, names);
      }, function () { go2.disabled = false; go2.textContent = 'Place order'; err.textContent = 'Network problem. Try again.'; err.hidden = false; });
    };
    openOv('cartModal', [E('h2', { text: 'My cart' }), listBox, sum, E('div', { class: 'cw-lbl', text: 'Your details' }), E('div', { class: 'cw-two' }, [f.n, f.ph]), E('div', { style: 'margin-top:8px' }, [f.em]), E('p', { class: 'pm-hint', text: 'Name and one contact (phone/WhatsApp or email) is all we need.' }), addr, payBox, err, E('div', { class: 'cw-actions' }, [go2])]);
  }
  function done(r, payLabel, names) {
    var m = S.methods.filter(function (x) { return x.label === payLabel; })[0], msg = 'Hello CUDWEARS, my order is ' + r.code + ' (' + names + '). I am paying the ' + naira(r.deposit) + ' deposit' + (payLabel ? ' by ' + payLabel : '') + '. Receipt attached.';
    openOv('orderModal', [E('div', { class: 'text-center' }, [E('h2', { text: 'Thank you!' }), E('p', { class: 'pm-note', text: 'Your tracking ID' }), E('h2', { text: r.code, style: 'letter-spacing:.1em' }),
      E('div', { class: 'cw-row', style: 'justify-content:center' }, [E('button', { type: 'button', class: 'btn btn-ghost', text: 'Copy tracking ID', onclick: function () { copy(r.code, 'Tracking ID copied'); } }), E('button', { type: 'button', class: 'btn btn-ghost', text: 'Track order', onclick: function () { closeOv('orderModal'); go('tab6'); } })]),
      E('p', { class: 'pm-hint', text: 'Saved on this phone, so you can find it under Track anytime.' })]),
      m ? payCard(m, r.deposit) : E('div', { class: 'cw-info', text: 'We will send you the payment details on WhatsApp.' }), E('p', { class: 'pm-hint', text: 'Balance of ' + naira(r.total - r.deposit) + ' is paid before or on delivery.' }),
      E('div', { class: 'cw-info' }, ['Estimated delivery: ', E('b', { text: S.lead_default }), ' after your deposit is confirmed.']),
      E('div', { class: 'cw-actions' }, [E('a', { class: 'btn btn-success', href: 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener', text: 'Send receipt on WhatsApp' })])]);
  }
  var cb = $('#cartBtn'); if (cb) cb.addEventListener('click', openCart);

  /* ---------------- tracking ---------------- */
  var FLOW = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered'], LAB = { pending: 'Pending', confirmed: 'Confirmed', in_production: 'Being made', shipped: 'On the way', delivered: 'Delivered', failed: 'Delivery failed', returned: 'Returned', cancelled: 'Cancelled' };
  function lookup(code, contact) { return sb.rpc('track_order', { p_code: code, p_phone: contact }).then(function (x) { return x.data || null; }, function () { return null; }); }
  function trackCard(r, mine) {
    var i = FLOW.indexOf(r.status), bal = Math.max(0, r.total - r.paid);
    return E('div', { class: 'card card-body mb-2' }, [
      E('div', { class: 'cw-li' }, [E('b', { text: r.code }), E('span', { class: 'cw-st ' + r.status, text: LAB[r.status] || r.status })]),
      E('div', { class: 'cw-row' }, [E('button', { type: 'button', class: 'cw-opt', text: 'Copy tracking ID', onclick: function () { copy(r.code, 'Tracking ID copied'); } }), mine ? E('button', { type: 'button', class: 'cw-opt', text: 'Forget', onclick: function () { LS.set('cw_orders', LS.get('cw_orders', []).filter(function (o) { return o.code !== r.code; })); renderMine(); } }) : null]),
      i > -1 ? E('div', { class: 'cw-steps' }, FLOW.map(function (x, k) { return E('i', { class: k <= i ? 'on' : '', text: LAB[x] }); })) : null,
      (r.items || []).map(function (x) { return E('p', { class: 'mb-1' }, [E('b', { text: x.qty + ' \u00D7 ' + x.name }), (x.colours || []).length ? ' \u00B7 ' + x.colours.map(function (c) { return c.name; }).join(', ') : '', x.size ? ' \u00B7 ' + x.size : '']); }),
      r.type === 'order' ? E('p', { class: 'pm-hint', text: 'Total ' + naira(r.total) + ' \u00B7 Paid ' + naira(r.paid) + ' \u00B7 Balance ' + naira(bal) + (r.paid < r.deposit_due ? ' \u00B7 Deposit due ' + naira(r.deposit_due - r.paid) : '') }) : null,
      r.expected_date ? E('div', { class: 'cw-info' }, ['Expected delivery: ', E('b', { text: new Date(r.expected_date + 'T00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) })]) : null,
      r.admin_note ? E('div', { class: 'cw-info cw-pre', text: r.admin_note }) : null]);
  }
  function renderMine() {
    var list = LS.get('cw_orders', []), box = $('#mine'); if (!box) return;
    if (!list.length) { box.replaceChildren(); return; }
    box.replaceChildren.apply(box, [E('h5', { class: 'sub-h', text: 'My orders' })].concat(list.map(function (o) { return E('div', { class: 'card card-body mb-2', id: 'm-' + o.code }, [E('b', { text: o.code }), E('span', { class: 'pm-hint', text: ' loading\u2026' })]); })));
    list.forEach(function (o) {
      lookup(o.code, o.contact).then(function (r) {
        var el = document.getElementById('m-' + o.code); if (!el) return;
        el.replaceWith(r ? trackCard(r, true) : E('div', { class: 'card card-body mb-2' }, [E('b', { text: o.code }), E('p', { class: 'pm-hint mb-0', text: 'Could not load this order right now.' })]));
      });
    });
  }
  $('#trackForm').addEventListener('submit', function (e) {
    e.preventDefault(); var er = $('#tErr'); er.hidden = true;
    var code = $('#tCode').value.trim().toUpperCase(), c = $('#tPhone').value.trim();
    lookup(code, c).then(function (r) {
      if (!r) { er.textContent = 'No order found. Check the code and your phone number or email.'; er.hidden = false; return; }
      var list = LS.get('cw_orders', []); if (!list.some(function (o) { return o.code === r.code; })) { list.unshift({ code: r.code, contact: c, name: '', at: Date.now() }); LS.set('cw_orders', list.slice(0, 30)); }
      renderMine(); toast('Order saved on this phone');
    });
  });
  renderMine();

  /* ---------------- size guide ---------------- */
  (function () {
    var all = []; Object.keys(FIELDS).forEach(function (k) { FIELDS[k].forEach(function (f) { if (all.indexOf(f) < 0) all.push(f); }); });
    var host = $('#measFields'), m = LS.get('cw_meas', {});
    host.replaceChildren.apply(host, all.map(function (k) { return E('input', { class: 'form-control', placeholder: k, 'aria-label': k, 'data-k': k, value: m[k] || '' }); }));
    $('#measForm').addEventListener('submit', function (e) { e.preventDefault(); var o = {}; host.querySelectorAll('input').forEach(function (i) { if (i.value.trim()) o[i.getAttribute('data-k')] = i.value.trim(); }); LS.set('cw_meas', o); toast('Measurements saved'); });
  })();

  /* ---------------- help / custom booking ---------------- */
  (function () {
    var kind = $('#hKind'), me = LS.get('cw_me', {});
    if (me.n) { $('#hName').value = me.n; $('#hPhone').value = me.ph || ''; $('#hEmail').value = me.em || ''; }
    function sync() { var k = kind.value; $('#hDateWrap').hidden = k !== 'booking'; $('#hCodeWrap').hidden = !(k === 'return' || k === 'complaint'); }
    kind.addEventListener('change', sync); sync();
    $('#helpForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var k = kind.value, er = $('#hErr'), ok = $('#hOk'); er.hidden = ok.hidden = true;
      var b = { name: $('#hName').value, phone: $('#hPhone').value, email: $('#hEmail').value, code: $('#hCode').value, text: $('#hText').value };
      var req;
      if (k === 'booking') req = sb.rpc('place_order', { p_type: 'booking', p_name: b.name, p_phone: b.phone || '', p_email: b.email || '', p_address: '', p_lat: null, p_lng: null, p_pay: '', p_note: 'Preferred date: ' + ($('#hDate').value || 'any') + '\n' + b.text, p_items: [] }).then(function (r) { return r.error ? { error: r.error.message } : r.data; });
      else req = sb.from('feedback').insert({ kind: k, code: (b.code || '').toUpperCase(), name: b.name, phone: b.phone || b.email || '', text: b.text }).then(function (r) { return r.error ? { error: 'Add your name and a message.' } : { ok: true }; });
      req.catch(function () { return { error: 'Network problem. Try again.' }; }).then(function (r) {
        if (r.error) { er.textContent = r.error; er.hidden = false; return; }
        if (r.code) { var l = LS.get('cw_orders', []); l.unshift({ code: r.code, contact: b.phone || b.email, name: 'Booking', at: Date.now() }); LS.set('cw_orders', l.slice(0, 30)); renderMine(); }
        ok.textContent = r.code ? 'Booking received. Your reference is ' + r.code + ' (saved under Track Order). We will contact you to confirm.' : 'Thank you. We have received your message.'; ok.hidden = false; $('#helpForm').reset(); sync();
      });
    });
  })();

  /* ---------------- global click glue (data-filter / data-tab / data-wa / seg) ---------------- */
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-filter]'); if (f) { e.preventDefault(); applyFilter(f.getAttribute('data-filter')); return; }
    var t = e.target.closest('[data-tab]'); if (t) { e.preventDefault(); go(t.getAttribute('data-tab')); return; }
    var o = e.target.closest('[data-open-product]'); if (o) { e.preventDefault(); window.CWX.openProduct(o.getAttribute('data-open-product')); return; }
    var w = e.target.closest('[data-wa]'); if (w) { e.preventDefault(); openWA(WA, w.getAttribute('data-wa')); return; }
    var sg = e.target.closest('[data-seg]');
    if (sg) { sg.parentElement.querySelectorAll('[data-seg]').forEach(function (b) { var on = b === sg; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); var pane = document.getElementById(b.getAttribute('data-seg')); if (pane) pane.hidden = !on; }); }
  });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-filter]')) { e.preventDefault(); e.target.click(); } });
  window.addEventListener('hashchange', function () { var m = location.hash.match(/^#p=([\w-]+)/); if (m && window.CWX._loaded) window.CWX.openProduct(m[1]); });



  /* quick CUDWEARS-style install of the manifest fallback + service worker (cache-bust friendly) */
  if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('js/sw.js').catch(function () {}); }
})();
