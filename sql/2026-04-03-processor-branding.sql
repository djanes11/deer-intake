alter table public.processors
  add column if not exists public_tagline text null,
  add column if not exists logo_url text null,
  add column if not exists support_phone_display text null,
  add column if not exists support_phone_e164 text null,
  add column if not exists support_email text null,
  add column if not exists public_address text null,
  add column if not exists public_maps_url text null,
  add column if not exists location_label text null;

update public.processors
set
  public_tagline = coalesce(public_tagline, 'Fast, clean, professional deer processing.'),
  logo_url = coalesce(logo_url, '/mcafee-logo.png'),
  support_phone_display = coalesce(support_phone_display, '(502) 643-3916'),
  support_phone_e164 = coalesce(support_phone_e164, '+15026433916'),
  public_address = coalesce(public_address, '10977 Buffalo Trace Rd, Palmyra, IN 47164'),
  location_label = coalesce(location_label, 'Palmyra, IN'),
  features = coalesce(features, '{"plan":"custom","smsEnabled":true,"webbsEnabled":true}'::jsonb)
where slug = 'mcafee';
