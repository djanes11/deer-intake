alter table public.site_settings
  add column if not exists standard_processing_price numeric not null default 130,
  add column if not exists caped_price numeric not null default 150,
  add column if not exists cape_donate_price numeric not null default 50,
  add column if not exists beef_fat_add_on numeric not null default 5,
  add column if not exists webbs_add_on numeric not null default 20,
  add column if not exists summer_sausage_price_per_lb numeric not null default 5,
  add column if not exists snack_stix_price_per_lb numeric not null default 8;

update public.site_settings
set
  standard_processing_price = coalesce(standard_processing_price, 130),
  caped_price = coalesce(caped_price, 150),
  cape_donate_price = coalesce(cape_donate_price, 50),
  beef_fat_add_on = coalesce(beef_fat_add_on, 5),
  webbs_add_on = coalesce(webbs_add_on, 20),
  summer_sausage_price_per_lb = coalesce(summer_sausage_price_per_lb, 5),
  snack_stix_price_per_lb = coalesce(snack_stix_price_per_lb, 8)
where id = 1;
