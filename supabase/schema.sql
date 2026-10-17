-- Dogear shared shelf. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.

create table if not exists public.dogear_entries (
  shelf      text   not null,
  id         text   not null,
  data       jsonb  not null,
  updated_at bigint not null,
  primary key (shelf, id)
);

-- Lock the table: nobody reads or writes it directly. The two functions below
-- are the only way in, and both require the secret shelf code.
alter table public.dogear_entries enable row level security;
revoke all on public.dogear_entries from anon, authenticated;

create or replace function public.dogear_pull(p_shelf text)
returns table (data jsonb)
language sql
security definer
set search_path = public
as $$
  select e.data from public.dogear_entries e
  where e.shelf = p_shelf and length(p_shelf) >= 24;
$$;

create or replace function public.dogear_push(p_shelf text, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_shelf) < 24 then
    raise exception 'shelf code too short';
  end if;
  if jsonb_array_length(p_entries) > 500 then
    raise exception 'too many entries in one push';
  end if;
  insert into public.dogear_entries as cur (shelf, id, data, updated_at)
  select p_shelf, e->>'id', e, (e->>'updatedAt')::bigint
  from jsonb_array_elements(p_entries) as e
  where e->>'id' is not null
  on conflict (shelf, id) do update
    set data = excluded.data, updated_at = excluded.updated_at
    where cur.updated_at <= excluded.updated_at;
end;
$$;

revoke all on function public.dogear_pull(text) from public;
revoke all on function public.dogear_push(text, jsonb) from public;
grant execute on function public.dogear_pull(text) to anon, authenticated;
grant execute on function public.dogear_push(text, jsonb) to anon, authenticated;
