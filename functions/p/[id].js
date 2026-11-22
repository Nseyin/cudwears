// Cloudflare Pages Function: dynamic product-share previews at /p/<product-id>
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
export async function onRequest({ request }) {
  const u = new URL(request.url), id = u.pathname.split('/').filter(Boolean).pop() || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.redirect(u.origin + '/', 302);
  try {
    const txt = await (await fetch(u.origin + '/config.js')).text();
    const g = k => (txt.match(new RegExp(k + '\\s*:\\s*[\\'\"]([^\\'\"]+)[\\'\"]')) || [])[1];
    const base = g('url'), key = g('key');
    if (!base || !key) return Response.redirect(u.origin + '/', 302);
    const response = await fetch(`${base}/rest/v1/products?id=eq.${encodeURIComponent(id)}&active=eq.true&select=*`, { headers: { apikey: key, authorization: 'Bearer ' + key } });
    if (!response.ok) return Response.redirect(u.origin + '/', 302);
    const rows = await response.json(), p = rows && rows[0];
    if (!p) return Response.redirect(u.origin + '/', 302);
    const img = p.imgs && p.imgs[0] ? `${base}/storage/v1/object/public/products/${p.imgs[0]}` : '';
    const title = `${p.name} | CUDWEARS`, price = '₦' + Number(p.price).toLocaleString('en-NG');
    const desc = `${price}. ${p.descr || 'Pick your colour, add your modifications and order on CUDWEARS.'}`.slice(0, 200);
    const page = u.origin + '/p/' + id;
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta property="og:type" content="product"><meta property="og:site_name" content="CUDWEARS"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(page)}">${img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:secure_url" content="${esc(img)}"><meta name="twitter:image" content="${esc(img)}">` : ''}<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${esc(title)}"><meta http-equiv="refresh" content="0;url=/#p=${id}"></head><body><a href="/#p=${id}">${esc(p.name)}</a></body></html>`, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=300' } });
  } catch { return Response.redirect(u.origin + '/', 302); }
}
