-- Supabase multiplayer foundation for 20-second mini games.
-- Run this migration after enabling Anonymous Sign-Ins in Supabase Auth.

create table if not exists public.game_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  game_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create table if not exists public.room_players (
  room_code text not null references public.game_rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host','guest')),
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id),
  unique (room_code, role)
);

create index if not exists game_rooms_expires_at_idx on public.game_rooms(expires_at);
create index if not exists room_players_user_id_idx on public.room_players(user_id);

alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;

create or replace function public.is_room_member(p_room_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_players rp
    where rp.room_code = upper(p_room_code)
      and rp.user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(text) from public;
grant execute on function public.is_room_member(text) to authenticated;

create or replace function public.create_game_room(p_code text)
returns table(code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(p_code));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if normalized !~ '^[A-Z0-9]{6}$' then
    raise exception 'INVALID_ROOM_CODE';
  end if;

  delete from public.game_rooms where expires_at < now();

  begin
    insert into public.game_rooms(code, host_id)
    values (normalized, auth.uid());
  exception when unique_violation then
    raise exception 'ROOM_CODE_TAKEN';
  end;

  insert into public.room_players(room_code, user_id, role)
  values (normalized, auth.uid(), 'host');

  return query select normalized, 'host'::text;
end;
$$;

create or replace function public.join_game_room(p_code text)
returns table(code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(p_code));
  target public.game_rooms;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into target
  from public.game_rooms
  where game_rooms.code = normalized
  for update;

  if not found or target.expires_at < now() then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if target.status <> 'waiting' then
    raise exception 'ROOM_NOT_JOINABLE';
  end if;
  if target.host_id = auth.uid() then
    return query select normalized, 'host'::text;
    return;
  end if;
  if exists (
    select 1 from public.room_players
    where room_code = normalized and role = 'guest' and user_id <> auth.uid()
  ) then
    raise exception 'ROOM_FULL';
  end if;

  insert into public.room_players(room_code, user_id, role)
  values (normalized, auth.uid(), 'guest')
  on conflict (room_code, user_id) do update set role = excluded.role;

  return query select normalized, 'guest'::text;
end;
$$;

create or replace function public.leave_game_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(p_code));
  was_host boolean;
begin
  if auth.uid() is null then return; end if;

  select exists (
    select 1 from public.room_players
    where room_code = normalized and user_id = auth.uid() and role = 'host'
  ) into was_host;

  delete from public.room_players
  where room_code = normalized and user_id = auth.uid();

  if was_host then
    delete from public.game_rooms where code = normalized and host_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.create_game_room(text) from public;
revoke all on function public.join_game_room(text) from public;
revoke all on function public.leave_game_room(text) from public;
grant execute on function public.create_game_room(text) to authenticated;
grant execute on function public.join_game_room(text) to authenticated;
grant execute on function public.leave_game_room(text) to authenticated;

-- Direct table writes are intentionally not granted; clients use the RPC functions above.
create policy "members can read their room"
on public.game_rooms
for select
to authenticated
using (public.is_room_member(code));

create policy "members can read room players"
on public.room_players
for select
to authenticated
using (public.is_room_member(room_code));

-- Private Realtime channel authorization. Channel topic format: room:ABC123
create policy "room members can receive realtime"
on realtime.messages
for select
to authenticated
using (
  public.is_room_member(split_part(realtime.topic(), ':', 2))
);

create policy "room members can send realtime"
on realtime.messages
for insert
to authenticated
with check (
  public.is_room_member(split_part(realtime.topic(), ':', 2))
);
