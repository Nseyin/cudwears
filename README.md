# CUDWEARS (built on the CUDMAZE template)

CUDMAZE's layout (header, sidebar, Home / Market / Services / Rentals / List bar, dark mode, search, overlays) with CUDWEARS's shop on top.

## What you get
- **Market**: designs from Supabase with category and type filters, sorting, search, hearts (saved), share links (/p/<id>).
- **Product sheet**: unlimited colours (6 per item) with photo preview, sizes, modifications, measurements, per-item customisation.
- **Cart + checkout**: up to 10 items per order, deposit %, OPay / PocketApp / bank cards, tracking ID, WhatsApp receipt.
- **Track Order** (saved on the phone + lookup), **Size Guide** (saved measurements pre-fill orders), **Custom & Help** (bookings, returns, complaints).
- **Services / Rentals / List**: tailoring, fittings, alterations, embroidery, laundry; outfit, bridal and accessory hire; anyone can list, you approve.
- **Designers**: multi-seller. Tag a product with a designer in Admin; approved "Designer / store" sign-ups appear on the Designers page.
- **admin.html**: orders, products (with Seller field), Listings approval, feedback, payment settings.

## Setup (about 10 minutes)
1. Supabase > SQL Editor: paste `setup/supabase.sql`, change PUT-YOUR-EMAIL-HERE to your admin email (first run only), Run. Safe to re-run.
2. Supabase > Authentication > Users: add that email with a password.
3. Put your project URL, anon key and WhatsApp number in `config.js`.
4. Deploy this project to Cloudflare Pages from GitHub. The `functions/p/[id].js` file powers the `/p/<id>` share previews.

## Hosting
This project uses Cloudflare Pages with Pages Functions for product-share previews. Supabase remains the database, authentication and storage provider. Cart, orders and saved designs are kept on the customer's phone instead.
