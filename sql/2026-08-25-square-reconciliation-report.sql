create index if not exists square_payment_links_processor_status_updated_idx
  on public.square_payment_links (processor_id, status, updated_at desc);
