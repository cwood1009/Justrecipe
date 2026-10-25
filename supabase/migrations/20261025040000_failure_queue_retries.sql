-- The daily job now looks at every queued link, not just "no recipe found"
-- ones: a link can flip between that and "blocked" from one try to the next.
-- It re-fetches each page, and only asks Grok when the page loads but still
-- can't be parsed. If the job itself is blocked, it retries on later runs;
-- this counts those tries.

alter table public.extraction_failures
  add column analysis_tries integer not null default 0;

drop index public.extraction_failures_queue_idx;
create index extraction_failures_queue_idx on public.extraction_failures (status, first_seen);
