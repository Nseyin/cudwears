# CUDWEARS: setup and updates

Three free accounts, one job each: **GitHub** keeps the files, **Supabase** keeps products, photos, orders and settings, **Netlify** puts the site online.

## UPDATING a site you already have online (this version)
1. **Supabase**: open SQL Editor > New query. Open `setup/supabase.sql` in Notepad, copy ALL of it, paste, click Run. It is safe to run again; your products, orders and admin login stay.
2. **GitHub**: unzip this folder, open your repository, click Add file > Upload files, drag EVERYTHING in (including the new `js` folder), click Commit changes. Netlify updates itself in about a minute. (`config.js` already has your Supabase details.)
3. **Admin > Settings**: type in your OPay, PocketApp and bank details (customers see them after ordering), check the 60% deposit, and set your usual delivery time and delivery instructions. Save.
4. Edit each existing product once (Admin > Products > Edit): pick its **Item type** and tick the modification options you want to offer, then Save.

## FIRST-TIME SETUP
1. Supabase: New project. SQL Editor: edit `PUT-YOUR-EMAIL-HERE` in `setup/supabase.sql` to your admin email, paste everything, Run. Then Authentication > Users > Add user (same email, a password, tick Auto Confirm).
2. Project Settings > API: copy the Project URL and the anon/publishable key into `config.js` (and your WhatsApp number).
3. GitHub: new repository, upload all the files. Netlify: Add new site > Import from GitHub, leave all boxes empty, Deploy.
4. Open your link + `/admin.html` and sign in.

## How things work
- Customers choose ANY colours (full palette plus a custom colour picker); the photo previews the colour. The preview works best on plain-coloured items on a plain background and is a guide only.
- Name plus one contact (phone/WhatsApp or email) is all that is required. Address is optional; customers can add it or share their GPS location. You see it (with a Google Maps link) in Admin > Orders.
- Payment is never forced online. Customers pick OPay, PocketApp or bank transfer, pay the deposit, and send the receipt on WhatsApp. In Admin > Orders tap "Deposit received" or "Fully paid".
- Set an expected delivery date and a note per order; customers see them under Track.
- Orders are remembered in the customer's browser (Track tab) with a Copy tracking ID button.

## The "Powered by Netlify" badge
Netlify adds it, not this code. The site leaves a clear strip at the bottom so it never covers a button. If you remove the badge in Netlify, change `--badge:46px` to `--badge:0px` at the top of `css/app.css`.

## If something is wrong
- "Signed in, but the database refused": run `setup/supabase.sql` again. If it lists nothing as admin, the email in the SQL differs from your Supabase user.
- Photo upload fails: run `setup/supabase.sql` again.
- Store empty: add a product in Admin first.
