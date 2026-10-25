-- Move the membership helpers out of the API-exposed public schema.
-- Row-level security policies refer to functions by identity, so they keep
-- working after the move; only signed-in users can execute the helpers.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_group_member(uuid) set schema private;
alter function public.is_group_owner(uuid) set schema private;
alter function public.can_view_shared_recipe(uuid, uuid) set schema private;

revoke execute on function private.is_group_member(uuid) from public, anon;
revoke execute on function private.is_group_owner(uuid) from public, anon;
revoke execute on function private.can_view_shared_recipe(uuid, uuid) from public, anon;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_owner(uuid) to authenticated;
grant execute on function private.can_view_shared_recipe(uuid, uuid) to authenticated;

-- These two call is_group_owner by name, so point them at its new home.
create or replace function public.remove_group_member(gid uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or (member <> auth.uid() and not private.is_group_owner(gid)) then
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

create or replace function public.reset_group_invite(gid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text := replace(gen_random_uuid()::text, '-', '');
begin
  if not private.is_group_owner(gid) then
    raise exception 'Not allowed';
  end if;
  update public.groups set invite_code = code where id = gid;
  return code;
end;
$$;
