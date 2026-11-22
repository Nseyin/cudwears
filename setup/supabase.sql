-- CUDWEARS database (shop + marketplace: designers, services, rentals). Paste ALL of this into Supabase > SQL Editor > Run.
-- Safe to run again at any time (new project OR to update an existing one).
-- NEW PROJECT ONLY: change PUT-YOUR-EMAIL-HERE below to your admin login email. If you already ran this before, leave it.
create table if not exists admins(email text primary key);
insert into admins(email) values ('PUT-YOUR-EMAIL-HERE') on conflict do nothing;
delete from admins where email='PUT-YOUR-EMAIL-HERE' and (select count(*) from admins)>1;

create or replace function is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from admins where lower(email)=lower(coalesce(auth.jwt()->>'email','')))
$$;

create table if not exists products(
  id uuid primary key default gen_random_uuid(), name text not null, cat text not null, sub text default '',
  price int not null check (price>=0), descr text default '', colours text[] default '{}', sizes text[] default '{}', mods text[] default '{}', imgs text[] default '{}',
  active boolean default true, created_at timestamptz default now());
alter table products add column if not exists kind text default '';
alter table products add column if not exists lead text default '';
alter table products add column if not exists featured boolean default false;
alter table products add column if not exists seller text default '';
alter table products drop constraint if exists products_cat_check;
alter table products add constraint products_cat_check check (cat in ('clothing','footwear','accessories'));

create table if not exists orders(
  code text primary key, type text default 'order' check (type in ('order','booking')), name text, phone text default '', address text default '',
  items jsonb default '[]', total int default 0, note text default '',
  status text default 'pending' check (status in ('pending','confirmed','in_production','shipped','delivered','failed','returned','cancelled')),
  created_at timestamptz default now(), updated_at timestamptz default now());
alter table orders add column if not exists email text default '';
alter table orders add column if not exists lat double precision;
alter table orders add column if not exists lng double precision;
alter table orders add column if not exists pay_method text default '';
alter table orders add column if not exists deposit_due int default 0;
alter table orders add column if not exists paid int default 0;
alter table orders add column if not exists expected_date date;
alter table orders add column if not exists admin_note text default '';

create table if not exists feedback(
  id bigint generated always as identity primary key, kind text check (kind in ('comment','complaint','return')),
  code text default '', name text, phone text default '', text text,
  status text default 'open' check (status in ('open','in_review','resolved')), created_at timestamptz default now());

create table if not exists settings(
  id int primary key default 1 check (id=1), deposit_pct int default 60 check (deposit_pct between 0 and 100),
  methods jsonb default '[]', lead_default text default '4-6 working days', delivery_info text default '');
insert into settings(id,methods,delivery_info) values (1,
  '[{"id":"opay","label":"OPay","bank":"OPay","account":"","name":"","link":"","details":""},{"id":"pocket","label":"PocketApp","bank":"","account":"","name":"","link":"","details":""},{"id":"bank","label":"Bank transfer","bank":"","account":"","name":"","link":"","details":""}]',
  E'Delivery time starts after your deposit is confirmed.\nWe will call or message you on WhatsApp before delivery.\nBalance is paid before or on delivery.')
on conflict (id) do nothing;

alter table admins enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table feedback enable row level security;
alter table settings enable row level security;

drop policy if exists "shop reads products" on products;
create policy "shop reads products" on products for select to anon, authenticated using (active or is_admin());
drop policy if exists "admin manages products" on products;
create policy "admin manages products" on products for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin manages orders" on orders;
create policy "admin manages orders" on orders for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "anyone sends feedback" on feedback;
create policy "anyone sends feedback" on feedback for insert to anon, authenticated with check (length(trim(name))>=2 and length(trim(text)) between 3 and 1000);
drop policy if exists "admin manages feedback" on feedback;
create policy "admin manages feedback" on feedback for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "shop reads settings" on settings;
create policy "shop reads settings" on settings for select to anon, authenticated using (true);
drop policy if exists "admin manages settings" on settings;
create policy "admin manages settings" on settings for all to authenticated using (is_admin()) with check (is_admin());

-- Customers place orders through this function (real prices come from your products table; deposit % from Settings).
drop function if exists place_order(text,text,text,text,text,jsonb);
create or replace function place_order(p_type text,p_name text,p_phone text,p_email text,p_address text,p_lat double precision,p_lng double precision,p_pay text,p_note text,p_items jsonb)
returns json language plpgsql security definer set search_path=public as $$
declare v_code text; v_total int:=0; v_dep int:=0; v_pct int:=60; v_items jsonb:='[]'; it jsonb; pr record; q int; la double precision:=p_lat; ln double precision:=p_lng;
        ph text:=regexp_replace(coalesce(p_phone,''),'\D','','g'); em text:=lower(trim(coalesce(p_email,'')));
begin
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Please enter your name.'; end if;
  if ph<>'' and (length(ph)<10 or length(ph)>15) then raise exception 'That phone number does not look right.'; end if;
  if em<>'' and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email does not look right.'; end if;
  if ph='' and em='' then raise exception 'Add a phone / WhatsApp number or an email so we can reach you.'; end if;
  if p_type not in ('order','booking') then p_type:='order'; end if;
  if la is null or ln is null or la not between -90 and 90 or ln not between -180 and 180 then la:=null; ln:=null; end if;
  select deposit_pct into v_pct from settings where id=1; v_pct:=coalesce(v_pct,60);
  if p_type='order' then
    if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>10 then raise exception 'Choose an item.'; end if;
    for it in select value from jsonb_array_elements(p_items) loop
      select id,name,price,seller into pr from products where id=(it->>'pid')::uuid and active;
      if not found then raise exception 'An item is no longer available.'; end if;
      q:=least(20,greatest(1,coalesce((it->>'qty')::int,1)));
      v_total:=v_total+pr.price*q;
      v_items:=v_items||jsonb_build_array(jsonb_build_object('pid',pr.id,'name',pr.name,'seller',coalesce(pr.seller,''),'price',pr.price,'qty',q,
        'colours',case when jsonb_typeof(it->'colours')='array' then (it->'colours') else '[]'::jsonb end,
        'size',left(coalesce(it->>'size',''),20),
        'mods',case when jsonb_typeof(it->'mods')='array' then (it->'mods') else '[]'::jsonb end,
        'note',left(coalesce(it->>'note',''),600)));
    end loop;
    v_dep:=ceil(v_total*v_pct/100.0)::int;
  end if;
  loop v_code:='CW-'||upper(substr(md5(random()::text||clock_timestamp()::text),1,6)); exit when not exists(select 1 from orders where code=v_code); end loop;
  insert into orders(code,type,name,phone,email,address,lat,lng,items,total,deposit_due,pay_method,note)
    values(v_code,p_type,left(trim(p_name),80),ph,left(em,120),left(coalesce(p_address,''),400),la,ln,v_items,v_total,v_dep,left(coalesce(p_pay,''),60),left(coalesce(p_note,''),600));
  return json_build_object('code',v_code,'total',v_total,'deposit',v_dep,'pct',v_pct);
end $$;

-- Customers track an order with the code + the phone number OR email they ordered with.
create or replace function track_order(p_code text,p_phone text) returns json language sql security definer set search_path=public as $$
  select json_build_object('code',code,'type',type,'status',status,'total',total,'deposit_due',deposit_due,'paid',paid,'pay_method',pay_method,
    'expected_date',expected_date,'admin_note',admin_note,'items',items,'created',created_at)
  from orders where code=upper(trim(p_code)) and (
    (phone<>'' and length(regexp_replace(coalesce(p_phone,''),'\D','','g'))>=9 and right(phone,9)=right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9))
    or (email<>'' and email=lower(trim(coalesce(p_phone,'')))) ) limit 1
$$;

-- Photo storage: everyone can see photos, only you can upload or delete.
insert into storage.buckets(id,name,public) values('products','products',true) on conflict (id) do nothing;
drop policy if exists "photos are public" on storage.objects;
create policy "photos are public" on storage.objects for select using (bucket_id='products');
drop policy if exists "admin manages photos" on storage.objects;
create policy "admin manages photos" on storage.objects for all to authenticated using (bucket_id='products' and is_admin()) with check (bucket_id='products' and is_admin());

-- Permissions for the website (newer Supabase projects do not grant these automatically).
grant usage on schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant select on products, settings to anon, authenticated;
grant insert, update, delete on products to authenticated;
grant insert, update, delete on settings to authenticated;
grant select, insert, update, delete on orders to authenticated;
grant insert on feedback to anon, authenticated;
grant select, update, delete on feedback to authenticated;
grant execute on function is_admin() to anon, authenticated;
grant execute on function place_order(text,text,text,text,text,double precision,double precision,text,text,jsonb) to anon, authenticated;
grant execute on function track_order(text,text) to anon, authenticated;

-- ===================== MARKETPLACE (designers, services, rentals) =====================

create table if not exists listings(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('store','service','rental')),
  grp text default '', type text default '', name text not null, descr text default '',
  state text default '', city text default '', price int default 0, unit text default '', extra text default '',
  phone text default '', rating numeric(2,1) default 0, reviews int default 0,
  verified boolean default false, remote boolean default false, nationwide boolean default false, available boolean default true,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  sample boolean default false, created_at timestamptz default now());
alter table listings enable row level security;

drop policy if exists "shop reads approved listings" on listings;
create policy "shop reads approved listings" on listings for select to anon, authenticated using (status='approved' or is_admin());
drop policy if exists "anyone lists a business" on listings;
create policy "anyone lists a business" on listings for insert to anon, authenticated
  with check (status='pending' and verified=false and sample=false and length(trim(name)) between 2 and 80 and length(trim(coalesce(descr,''))) between 10 and 400 and length(regexp_replace(coalesce(phone,''),'\D','','g')) between 10 and 15);
drop policy if exists "admin manages listings" on listings;
create policy "admin manages listings" on listings for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert on listings to anon, authenticated;
grant update, delete on listings to authenticated;

-- SAMPLE listings so the Services, Rentals and Designers pages are not empty on day one.
-- Replace them: Admin > Listings > delete the ones marked Sample, then approve real sign-ups.
insert into listings(kind,grp,type,name,descr,state,city,price,unit,rating,reviews,verified,remote,nationwide,available,status,sample)
select * from (values
 ('store','Clothing','Designer','Adire & Ankara Studio','Ready-to-wear and made-to-order Ankara, adire and lace outfits.','Lagos','Surulere',0,'',4.9,61,true,false,true,true,'approved',true),
 ('store','Footwear','Shoemaker','Ibadan Soles','Handmade leather sandals, loafers and slides in your size.','Oyo','Ibadan',0,'',4.7,34,true,false,true,true,'approved',true),
 ('store','Bags & Home','Home & bags','Kano Weave House','Woven bags, cushion covers and table linen.','Kano','Kano',0,'',4.6,22,false,false,true,true,'approved',true),
 ('service','fashion','Tailor','Stitch & Style Atelier','Native wear, corporate suits and aso-ebi sewing with fast turnaround.','Imo','Owerri',12000,'per job',4.8,49,true,false,true,true,'approved',true),
 ('service','fashion','Fashion Designer','Lola Couture Lagos','Custom gowns and two-piece sets. Fittings by appointment.','Lagos','Lekki',45000,'per job',4.9,77,true,false,true,true,'approved',true),
 ('service','fitting','Fitting Session','Fit & Finish Studio','In-person measurements and fitting for any outfit you already own or ordered.','Lagos','Yaba',5000,'per session',4.7,40,true,false,false,true,'approved',true),
 ('service','alter','Alterations','Quick Fix Alterations','Hemming, taking in, letting out and zip replacement, same-day on request.','FCT Abuja','Wuse 2',3000,'per job',4.6,58,false,false,false,true,'approved',true),
 ('service','craft','Embroidery & Beadwork','Bead & Thread Co.','Hand embroidery, monograms and beadwork for gowns and caps.','Anambra','Onitsha',8000,'per job',4.8,29,true,false,true,true,'approved',true),
 ('service','care','Laundry & Dry Cleaning','Crisp Care Laundry','Pickup and delivery dry-cleaning for suits, gowns and traditional wear.','Lagos','Ikeja',2500,'per job',4.5,83,true,false,false,true,'approved',true),
 ('rental','wear','Gowns & Evening Dresses','Glam Gown Hire','Evening gowns and prom dresses by the day, cleaned and ready to wear.','Lagos','Victoria Island',25000,'per day',4.8,52,true,false,false,true,'approved',true),
 ('rental','wear','Suits & Tuxedos','Sharp Suits Rentals','Tuxedos, three-piece suits and accessories for weddings and events.','FCT Abuja','Garki',20000,'per day',4.7,44,true,false,false,true,'approved',true),
 ('rental','wear','Aso-ebi & Traditional Attire','Heritage Attire Hire','Complete agbada, buba and iro and gele, and Igbo and Northern traditional sets.','Oyo','Ibadan',18000,'per event',4.7,31,true,false,true,true,'approved',true),
 ('rental','bridal','Bridal Gowns & Veils','Forever Bridal Rentals','Wedding gowns, veils and tiaras with fitting included.','Lagos','Lekki',80000,'per event',4.9,26,true,false,true,true,'approved',true),
 ('rental','acc','Jewellery & Accessories','Sparkle Box Hire','Statement necklaces, gele and fascinators for the day.','Rivers','Port Harcourt',6000,'per day',4.5,18,false,false,false,true,'approved',true),
 ('rental','acc','Shoes & Bags','Heels on Hire','Occasion heels and clutch bags in most sizes.','Enugu','Independence Layout',5000,'per day',4.4,15,false,false,false,true,'approved',true)
) as v(kind,grp,type,name,descr,state,city,price,unit,rating,reviews,verified,remote,nationwide,available,status,sample)
where not exists (select 1 from listings where sample);
