# CUDWEARS: put it online (about 20 minutes, nothing to install)

You need three free accounts. Each one has one job:
- **GitHub** keeps your website files.
- **Supabase** keeps your products, photos and orders.
- **Netlify** puts the website on the internet.

## 1. Supabase (your database)
1. Go to supabase.com, sign up, click **New project**. Name it `cudwears`, make up a database password (save it), pick the closest region (South Africa or London), click Create. Wait until it finishes.
2. Open the file `setup/supabase.sql` on your computer with Notepad. Change `PUT-YOUR-EMAIL-HERE` to the email you will use to log in as admin. Select everything and copy it.
3. In Supabase click **SQL Editor** (left side) > **New query**, paste, click **Run**. It should say "Success".
4. Click **Authentication** > **Users** > **Add user** > **Create new user**. Use the SAME email, make a password, tick **Auto Confirm User**, Create. This is your admin login.
5. Click **Project Settings** > **API** (or "API Keys"). Copy the **Project URL** and the **anon public** key (newer projects call it "publishable key").
6. Open `config.js` with Notepad. Paste the URL and key between the quotes. Put your WhatsApp number too. Save.

## 2. GitHub (keeps the files)
1. Sign up at github.com. Click **+** > **New repository**. Name it `cudwears`, click Create repository.
2. Click **uploading an existing file**. Unzip this folder first, then drag EVERYTHING inside it (including the `netlify`, `css` and `setup` folders) into the page. Click **Commit changes**.

## 3. Netlify (puts it online)
1. Sign up at netlify.com with your GitHub account.
2. **Add new site** > **Import an existing project** > **GitHub** > choose `cudwears`.
3. Leave every box empty (no build command, no publish folder). Click **Deploy**. In about a minute you get a link like `something.netlify.app`.

## Use it
- Store: your Netlify link. Admin: your link + `/admin.html`. Log in with the email and password from step 1.4.
- Add designs in Admin > Products. You never need GitHub again for products, photos or orders. Photos are resized (never cropped) and compressed automatically.
- Orders, bookings, deliveries, returns, complaints and comments are all in Admin.
- Sharing: the Share button on each design gives a link (`/p/...`). WhatsApp, Facebook and X show the photo, name and price.

## If something is wrong
- Store is empty or errors: the two values in `config.js` are wrong, or you haven't added a product yet.
- "Not set up as admin": the email in the SQL (step 1.2) differs from the user you created (step 1.4).
- Photo upload fails: step 1.3 did not run fully. Run the SQL again.
- After editing `config.js` later, upload the new file on GitHub (Add file > Upload files) and Netlify updates itself.
