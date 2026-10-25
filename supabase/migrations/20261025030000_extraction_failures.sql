-- Links we couldn't pull a recipe from. The server records them, a daily job
-- asks Grok where the recipe is on the page, and files a GitHub issue with a
-- suggested parser fix for Claude to pick up.
-- Only the server (service role) touches this table: RLS is on with no policies.

create table public.extraction_failures (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (char_length(url) <= 2000),
  host text not null,
  reason text not null check (reason in ('no_recipe', 'blocked', 'error')),
  message text,
  attempts integer not null default 1,
  status text not null default 'new'
    check (status in ('new', 'analyzing', 'reported', 'duplicate', 'resolved', 'failed')),
  analysis jsonb,
  issue_url text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  analyzed_at timestamptz
);

create index extraction_failures_queue_idx on public.extraction_failures (status, reason, first_seen);
create index extraction_failures_host_idx on public.extraction_failures (host);

alter table public.extraction_failures enable row level security;
revoke all on public.extraction_failures from anon, authenticated;

-- Records a failure, or bumps the count if the link failed before. A link that
-- was fixed ("resolved") and fails again goes back in the queue.
create function public.record_extraction_failure(page_url text, failure_reason text, failure_message text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.extraction_failures (url, host, reason, message)
  values (
    left(page_url, 2000),
    coalesce(substring(page_url from '^https?://([^/:?#]+)'), ''),
    failure_reason,
    left(failure_message, 500)
  )
  on conflict (url) do update set
    attempts = public.extraction_failures.attempts + 1,
    last_seen = now(),
    reason = excluded.reason,
    message = excluded.message,
    status = case
      when public.extraction_failures.status = 'resolved' then 'new'
      else public.extraction_failures.status
    end;
$$;

revoke execute on function public.record_extraction_failure(text, text, text) from public, anon, authenticated;
grant execute on function public.record_extraction_failure(text, text, text) to service_role;
