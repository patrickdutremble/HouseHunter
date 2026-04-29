-- Indexes for the three hot query paths on listings:
--   1. status_checked_at      -> staleness sweep in refresh-statuses
--   2. (status, deleted_at)   -> "active and not deleted" filter on every page
--   3. centris_link           -> dedupe lookup on every scrape

create index if not exists listings_status_checked_at_idx
  on public.listings (status_checked_at);

create index if not exists listings_status_deleted_at_idx
  on public.listings (status, deleted_at);

create index if not exists listings_centris_link_idx
  on public.listings (centris_link);
