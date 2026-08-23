create unique index if not exists jobs_public_token_unique_idx
  on public.jobs (public_token)
  where public_token is not null and public_token <> '';
