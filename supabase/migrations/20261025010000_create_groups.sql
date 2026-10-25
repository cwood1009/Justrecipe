-- Groups let people share recipes with family and friends.
-- A recipe is shared with a group either one at a time (group_recipes) or
-- because its owner turned on "share all my recipes" for that group (share_all).

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  role text not null default 'member' check (role in ('owner', 'member')),
  share_all boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

create table public.group_recipes (
  group_id uuid not null references public.groups (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  shared_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (group_id, recipe_id)
);

create index group_recipes_recipe_id_idx on public.group_recipes (recipe_id);

-- ---------- Helpers (security definer so policies don't recurse) ----------

create function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$;

create function public.is_group_owner(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- True when the recipe is shared with a group the current user belongs to.
create function public.can_view_shared_recipe(rid uuid, owner uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_recipes gr
    join public.group_members me
      on me.group_id = gr.group_id and me.user_id = (select auth.uid())
    where gr.recipe_id = rid
  ) or exists (
    select 1
    from public.group_members theirs
    join public.group_members me
      on me.group_id = theirs.group_id and me.user_id = (select auth.uid())
    where theirs.user_id = owner and theirs.share_all
  );
$$;

-- ---------- Row-level security ----------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_recipes enable row level security;

-- Recipes: you can read your own and any shared with your groups.
drop policy "Users can read their own recipes" on public.recipes;
create policy "Users can read their own and shared recipes"
  on public.recipes for select
  to authenticated
  using ((select auth.uid()) = user_id or public.can_view_shared_recipe(id, user_id));

create policy "Members can see their groups"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "Owners can update their groups"
  on public.groups for update
  to authenticated
  using (public.is_group_owner(id))
  with check (public.is_group_owner(id));

create policy "Owners can delete their groups"
  on public.groups for delete
  to authenticated
  using (public.is_group_owner(id));

create policy "Members can see each other"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

-- Members may only change their own "share all" setting.
create policy "Members can update their own membership"
  on public.group_members for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke update on public.group_members from authenticated, anon;
grant update (share_all) on public.group_members to authenticated;

create policy "Members can see shared recipes"
  on public.group_recipes for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "Members can share their own recipes"
  on public.group_recipes for insert
  to authenticated
  with check (
    (select auth.uid()) = shared_by
    and public.is_group_member(group_id)
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  );

create policy "Sharers and owners can unshare"
  on public.group_recipes for delete
  to authenticated
  using ((select auth.uid()) = shared_by or public.is_group_owner(group_id));

-- ---------- Actions that need to bypass RLS safely ----------

create function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.groups (name) values (trim(group_name)) returning id into gid;
  insert into public.group_members (group_id, user_id, email, role)
  values (gid, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'owner');
  return gid;
end;
$$;

-- What the invite page shows before someone joins.
create function public.get_group_invite(code text)
returns table (id uuid, name text, member_count integer)
language sql
security definer
stable
set search_path = ''
as $$
  select g.id, g.name, (select count(*)::integer from public.group_members m where m.group_id = g.id)
  from public.groups g
  where g.invite_code = code;
$$;

create function public.join_group(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select g.id into gid from public.groups g where g.invite_code = code;
  if gid is null then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id, email)
  values (gid, auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
  on conflict do nothing;
  return gid;
end;
$$;

-- Removes a member and the recipes they shared. If the last owner leaves,
-- the longest-standing member becomes owner; an empty group is deleted.
create function public.remove_group_member(gid uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or (member <> auth.uid() and not public.is_group_owner(gid)) then
    raise exception 'Not allowed';
  end if;

  delete from public.group_recipes where group_id = gid and shared_by = member;
  delete from public.group_members where group_id = gid and user_id = member;

  if not exists (select 1 from public.group_members where group_id = gid) then
    delete from public.groups where id = gid;
  elsif not exists (select 1 from public.group_members where group_id = gid and role = 'owner') then
    update public.group_members set role = 'owner'
    where group_id = gid
      and user_id = (
        select user_id from public.group_members
        where group_id = gid order by joined_at limit 1
      );
  end if;
end;
$$;

create function public.reset_group_invite(gid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_group_owner(gid) then
    raise exception 'Not allowed';
  end if;
  update public.groups set invite_code = code where id = gid;
  return code;
end;
$$;

-- Recipes visible in a group, newest first. Runs with the caller's
-- permissions, so non-members get nothing back.
create function public.get_group_recipes(gid uuid)
returns table (
  id uuid,
  title text,
  site_name text,
  image_url text,
  total_time text,
  owner_id uuid,
  shared_by_email text,
  shared_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from (
    select distinct on (r.id)
      r.id, r.title, r.site_name, r.image_url, r.total_time, r.user_id,
      m.email, coalesce(gr.shared_at, r.created_at) as shared_at
    from public.recipes r
    join public.group_members m on m.group_id = gid and m.user_id = r.user_id
    left join public.group_recipes gr on gr.group_id = gid and gr.recipe_id = r.id
    where gr.recipe_id is not null or m.share_all
    order by r.id
  ) visible
  order by visible.shared_at desc;
$$;

-- Only signed-in users may call the actions (the invite preview stays public
-- so the join page can show the group's name before you sign in).
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.reset_group_invite(uuid) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.reset_group_invite(uuid) to authenticated;
