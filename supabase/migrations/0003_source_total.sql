-- How many reviews Booking.com said the property had, as reported on each run.
-- Lets the dashboard state coverage ("600 of 4,313 held") from data rather than
-- a hard-coded number that goes stale. Nullable: older runs never recorded it,
-- and a failed run may not have reached the source at all.
alter table collection_run
  add column if not exists source_total integer check (source_total >= 0);
