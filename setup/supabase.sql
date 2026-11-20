-- CUDWEARS database. Paste ALL of this into Supabase > SQL Editor > Run.
-- STEP FIRST: change PUT-YOUR-EMAIL-HERE below to the email you will use to log in to the admin page.
create table if not exists admins(email text primary key);
insert into admins(email) values ('PUT-YOUR-EMAIL-HERE') on conflict do nothing;

create or replace function is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from admins where lower(email)=lower(coalesce(auth.jwt()->>'email','')))
$$;

create table if not exists products(
  id uuid primary key default gen_random_uuid(), name text not null,
  cat text not null check (cat in ('clothing','footwear')), sub text default '',
  price int not null check (price>=0), descr text default '',
  colours text[] default '{}', sizes text[] default '{}', mods text[] default '{}', imgs text[] default '{}',
  active boolean default true, created_at timestamptz default now());
create table if not exists orders(
  code text primary key, type text default 'order' check (type in ('order','booking')), name text, phone text, address text default '',
  items jsonb default '[]', total int default 0, note text default '',
  status text default 'pending' check (status in ('pending','confirmed','in_production','shipped','delivered','failed','returned','cancelled')),
  created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists feedback(
  id bigint generated always as identity primary key, kind text check (kind in ('comment','complaint','return')),
  code text default '', name text, phone text default '', text text,
  status text default 'open' check (status in ('open','in_review','resolved')), created_at timestamptz default now());

alter table admins enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table feedback enable row level security;

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

-- Customers place orders through this function (it uses the real prices from your products table).
create or replace function place_order(p_type text,p_name text,p_phone text,p_address text,p_note text,p_items jsonb)
returns json language plpgsql security definer set search_path=public as $$
declare v_code text; v_total int:=0; v_items jsonb:='[]'; it jsonb; pr record; q int;
        ph text:=regexp_replace(coalesce(p_phone,''),'\D','','g');
begin
  if length(trim(coalesce(p_name,'')))<2 or length(ph)<10 or length(ph)>15 then raise exception 'Enter your name and a valid phone number.'; end if;
  if p_type not in ('order','booking') then p_type:='order'; end if;
  if p_type='order' then
    if length(trim(coalesce(p_address,'')))<5 then raise exception 'Enter a delivery address.'; end if;
    if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>10 then raise exception 'Choose an item.'; end if;
    for it in select value from jsonb_array_elements(p_items) loop
      select id,name,price into pr from products where id=(it->>'pid')::uuid and active;
      if not found then raise exception 'An item is no longer available.'; end if;
      q:=least(20,greatest(1,coalesce((it->>'qty')::int,1)));
      v_total:=v_total+pr.price*q;
      v_items:=v_items||jsonb_build_array(jsonb_build_object('pid',pr.id,'name',pr.name,'price',pr.price,'qty',q,
        'colour',left(coalesce(it->>'colour',''),40),'size',left(coalesce(it->>'size',''),20),
        'mods',coalesce(it->'mods','[]'::jsonb),'note',left(coalesce(it->>'note',''),400)));
    end loop;
  end if;
  loop v_code:='CW-'||upper(substr(md5(random()::text||clock_timestamp()::text),1,6)); exit when not exists(select 1 from orders where code=v_code); end loop;
  insert into orders(code,type,name,phone,address,items,total,note)
    values(v_code,p_type,left(trim(p_name),80),ph,left(coalesce(p_address,''),300),v_items,v_total,left(coalesce(p_note,''),600));
  return json_build_object('code',v_code,'total',v_total);
end $$;

-- Customers track an order with the code + their phone number.
create or replace function track_order(p_code text,p_phone text) returns json language sql security definer set search_path=public as $$
  select json_build_object('code',code,'type',type,'status',status,'total',total,'items',items,'created',created_at)
  from orders where code=upper(trim(p_code))
   and length(regexp_replace(coalesce(p_phone,''),'\D','','g'))>=9
   and right(phone,9)=right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9) limit 1
$$;

-- Photo storage: everyone can see photos, only you can upload or delete.
insert into storage.buckets(id,name,public) values('products','products',true) on conflict (id) do nothing;
drop policy if exists "photos are public" on storage.objects;
create policy "photos are public" on storage.objects for select using (bucket_id='products');
drop policy if exists "admin manages photos" on storage.objects;
create policy "admin manages photos" on storage.objects for all to authenticated using (bucket_id='products' and is_admin()) with check (bucket_id='products' and is_admin());
