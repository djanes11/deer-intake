alter table public.square_payment_links
  add column if not exists processing_amount_cents integer,
  add column if not exists online_fee_cents integer not null default 0;

update public.square_payment_links
set processing_amount_cents = amount_cents
where processing_amount_cents is null;
