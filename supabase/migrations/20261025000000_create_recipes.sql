-- Saved recipes. Each row belongs to one user and is only visible to them.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_url text not null,
  site_name text,
  title text not null,
  description text,
  image_url text,
  author text,
  yield text,
  prep_time text,
  cook_time text,
  total_time text,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_url)
);

create index recipes_user_id_created_at_idx on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

create policy "Users can read their own recipes"
  on public.recipes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own recipes"
  on public.recipes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own recipes"
  on public.recipes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own recipes"
  on public.recipes for delete
  to authenticated
  using ((select auth.uid()) = user_id);
