/* CUDWEARS shared helpers: colour palette, colour preview (recolour), item types + modification options. */
(function (g) {
  var COLORS = [['Black','#111111'],['White','#FFFFFF'],['Cream','#F3EAD3'],['Beige','#D9C3A0'],['Tan','#B88A5A'],['Camel','#C19A6B'],['Brown','#6B4423'],['Chocolate','#3B2314'],['Grey','#8E8E8E'],['Silver','#C0C0C0'],['Charcoal','#36393D'],['Navy','#14213D'],['Royal Blue','#1F4FD8'],['Sky Blue','#7EC8F0'],['Teal','#127C7C'],['Turquoise','#2EC4B6'],['Mint','#A8E6CF'],['Emerald','#0B8F5A'],['Forest Green','#1E5631'],['Olive','#6B7A2B'],['Lemon','#F7E463'],['Mustard','#D9A21B'],['Gold','#C9A227'],['Orange','#F07C1F'],['Peach','#FFB38A'],['Coral','#FF6F61'],['Red','#D32030'],['Wine','#722F37'],['Maroon','#5E1224'],['Blush Pink','#F4C2C2'],['Hot Pink','#FF2E93'],['Fuchsia','#C2185B'],['Purple','#6A2C91'],['Lavender','#B9A3E3'],['Lilac','#C8A2C8']];
  var CATS = { clothing: 'Clothing', footwear: 'Footwear', accessories: 'Bags & Home' };
  var KINDS = {
    'Shirt': { cat: 'clothing', mods: ['Long sleeves','Short sleeves','Three-quarter sleeves','Mandarin collar','Classic collar','Add chest pocket','No pocket','Slim fit','Regular fit','Oversized fit','Shorter length','Longer length','Contrast buttons','Contrast cuffs and collar','Add embroidery','Add initials / monogram'] },
    'Dress': { cat: 'clothing', mods: ['Add sleeves','Sleeveless','Off-shoulder','Above-knee length','Midi length','Maxi length','Add slit','Add pockets','Open back','Fitted bodice','Add belt / sash','Zip back','Add lining','Add beads / embroidery'] },
    'Pant': { cat: 'clothing', mods: ['Straight leg','Slim leg','Wide leg','Cuffed hem','Shorter length','Longer length','Elastic waist','Zip and button','Add side pockets','Add back pockets','Add belt loops','Add lining','Drawstring waist'] },
    'Skirt': { cat: 'clothing', mods: ['Mini length','Midi length','Maxi length','Add slit','Pleated','A-line','Pencil fit','High waist','Elastic waist','Zip closure','Add pockets','Add lining','Add ruffle / frill'] },
    'Shoe': { cat: 'footwear', mods: ['Block heel','Flat sole','Higher heel','Lower heel','Wider fit','Cushioned insole','Ankle strap','Add buckle','Open toe','Closed toe','Leather finish','Suede finish','Different sole colour','Add initials'] },
    'Runners': { cat: 'footwear', mods: ['Extra cushioned sole','Wider fit','Higher ankle','Low cut','Different lace colour','Different sole colour','Breathable mesh','Waterproof finish','Orthopaedic insole','Add initials'] },
    'Sandals & Slippers': { cat: 'footwear', mods: ['Flat sole','Wedge','Block heel','Ankle strap','Wider fit','Cushioned insole','Add buckle','Open toe','Leather finish','Add initials'] },
    'Bag': { cat: 'accessories', mods: ['Add inner zip pocket','Add initials / monogram','Longer strap','Shorter strap','Adjustable strap','Bigger size','Smaller size','Gold hardware','Silver hardware','Different lining colour','Magnetic closure','Zip closure','Add tassel / charm'] },
    'Pillow': { cat: 'accessories', mods: ['Bigger size','Smaller size','Add piping','Zip closure','Envelope closure','Add embroidery / monogram','Add tassels','Insert included','Washable cover','Velvet finish','Contrast back'] },
    'Tablecloth': { cat: 'accessories', mods: ['Round','Rectangle','Square','Custom size','Add lace trim','Add embroidery','Add tassels','Scalloped edge','Waterproof coating','Matching napkins','Matching table runner','Longer drop'] }
  };
  function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgbHsl(r, g2, b) { r /= 255; g2 /= 255; b /= 255; var mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g2 - b) / d + (g2 < b ? 6 : 0) : mx === g2 ? (b - r) / d + 2 : (r - g2) / d + 4; h /= 6; } return [h, s, l]; }
  function hslRgb(h, s, l) { function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    if (!s) return [l * 255, l * 255, l * 255]; var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]; }
  function nearest(hex) { var c = hexRgb(hex), best = COLORS[0], bd = 1e9; COLORS.forEach(function (x) { var k = hexRgb(x[1]), d = Math.pow(c[0] - k[0], 2) + Math.pow(c[1] - k[1], 2) + Math.pow(c[2] - k[2], 2); if (d < bd) { bd = d; best = x; } }); return best[0]; }
  // Recolour the garment but keep its shading: the plain background (found from the picture edges) is left untouched.
  function recolorData(d, w, h, hex) {
    var t = hexRgb(hex), th = rgbHsl(t[0], t[1], t[2]), tH = th[0], tS = th[1], tL = th[2], br = 0, bg = 0, bb = 0, n = 0, i, x, y;
    function add(px, py) { var j = (py * w + px) * 4; br += d[j]; bg += d[j + 1]; bb += d[j + 2]; n++; }
    for (x = 0; x < w; x++) { add(x, 0); add(x, h - 1); } for (y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
    br /= n; bg /= n; bb /= n;
    function near(p) { var j = p * 4; return d[j + 3] < 20 || Math.abs(d[j] - br) + Math.abs(d[j + 1] - bg) + Math.abs(d[j + 2] - bb) < 70; }
    var bgm = new Uint8Array(w * h), st = [];
    function seed(p) { if (!bgm[p] && near(p)) { bgm[p] = 1; st.push(p); } }
    for (x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); } for (y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0; if (px > 0) seed(p - 1); if (px < w - 1) seed(p + 1); if (py > 0) seed(p - w); if (py < h - 1) seed(p + w); }
    var sl = 0, c = 0; for (i = 0; i < w * h; i++) if (!bgm[i]) { var j = i * 4; sl += rgbHsl(d[j], d[j + 1], d[j + 2])[2]; c++; }
    if (!c) return 0; var al = sl / c, k = (tL < .2 || tL > .85) ? .35 : .85;
    for (i = 0; i < w * h; i++) if (!bgm[i]) { var j2 = i * 4, o = rgbHsl(d[j2], d[j2 + 1], d[j2 + 2]), l2 = Math.min(.97, Math.max(.03, tL + (o[2] - al) * k)), s2 = tS * Math.min(1, .6 + o[1]), r = hslRgb(tH, s2, l2); d[j2] = r[0]; d[j2 + 1] = r[1]; d[j2 + 2] = r[2]; }
    return c;
  }
  var cache = {};
  function recolor(src, hex, max) {
    var key = src + hex; if (cache[key]) return Promise.resolve(cache[key]);
    return new Promise(function (res, rej) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = rej; im.src = src; }).then(function (im) {
      var s = Math.min(1, (max || 640) / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
      var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height); var id = cx.getImageData(0, 0, cv.width, cv.height); recolorData(id.data, cv.width, cv.height, hex); cx.putImageData(id, 0, 0); return (cache[key] = cv.toDataURL('image/webp', .85));
    });
  }
  g.CW = { COLORS: COLORS, CATS: CATS, KINDS: KINDS, nearest: nearest, recolor: recolor, recolorData: recolorData, hexRgb: hexRgb, rgbHsl: rgbHsl };
  if (typeof module !== 'undefined') module.exports = g.CW;
})(typeof window !== 'undefined' ? window : globalThis);
