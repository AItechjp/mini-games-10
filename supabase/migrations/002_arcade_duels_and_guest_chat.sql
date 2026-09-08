-- GAME 11/12 duel rooms + GAME 13 guest chat
create or replace function public.create_duel_room(p_code text, p_player_token uuid, p_game_id text)
returns table(code text, role text, player_token uuid, channel_key uuid, game_id text)
language plpgsql security definer set search_path = public as $$
declare normalized text := upper(trim(p_code)); normalized_game text := lower(trim(p_game_id)); created public.game_rooms;
begin
  if normalized !~ '^[A-Z0-9]{6}$' then raise exception 'INVALID_ROOM_CODE'; end if;
  if p_player_token is null then raise exception 'INVALID_PLAYER_TOKEN'; end if;
  if normalized_game not in ('fps','shooter') then raise exception 'INVALID_GAME_ID'; end if;
  delete from public.game_rooms where expires_at < now();
  begin insert into public.game_rooms(code,host_token,game_id) values(normalized,p_player_token,normalized_game) returning * into created;
  exception when unique_violation then raise exception 'ROOM_CODE_TAKEN'; end;
  return query select created.code,'host'::text,p_player_token,created.channel_key,created.game_id;
end;$$;

create or replace function public.join_duel_room(p_code text, p_player_token uuid, p_game_id text)
returns table(code text, role text, player_token uuid, channel_key uuid, game_id text)
language plpgsql security definer set search_path = public as $$
declare normalized text := upper(trim(p_code)); normalized_game text := lower(trim(p_game_id)); target public.game_rooms;
begin
  if p_player_token is null then raise exception 'INVALID_PLAYER_TOKEN'; end if;
  if normalized_game not in ('fps','shooter') then raise exception 'INVALID_GAME_ID'; end if;
  delete from public.game_rooms where expires_at < now();
  select * into target from public.game_rooms where game_rooms.code=normalized for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if target.game_id<>normalized_game then raise exception 'WRONG_GAME'; end if;
  if target.host_token=p_player_token then
    update public.game_rooms set updated_at=now(),expires_at=now()+interval '2 hours' where game_rooms.code=normalized;
    return query select target.code,'host'::text,p_player_token,target.channel_key,target.game_id; return;
  end if;
  if target.guest_token is not null and target.guest_token<>p_player_token then raise exception 'ROOM_FULL'; end if;
  update public.game_rooms set guest_token=p_player_token,updated_at=now(),expires_at=now()+interval '2 hours' where game_rooms.code=normalized;
  return query select target.code,'guest'::text,p_player_token,target.channel_key,target.game_id;
end;$$;

revoke all on function public.create_duel_room(text,uuid,text) from public;
revoke all on function public.join_duel_room(text,uuid,text) from public;
grant execute on function public.create_duel_room(text,uuid,text) to anon,authenticated;
grant execute on function public.join_duel_room(text,uuid,text) to anon,authenticated;

create table if not exists public.chat_messages(
  id bigint generated always as identity primary key,
  room text not null default 'lobby' check(room~'^[a-z0-9_-]{1,32}$'),
  nickname text not null check(char_length(nickname) between 1 and 16),
  body text not null check(char_length(body) between 1 and 240),
  client_token uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room_id_idx on public.chat_messages(room,id desc);
create index if not exists chat_messages_client_time_idx on public.chat_messages(client_token,created_at desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon,authenticated;

create or replace function public.post_chat_message(p_room text,p_nickname text,p_body text,p_client_token uuid)
returns table(id bigint,room text,nickname text,body text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare normalized_room text:=lower(trim(p_room)); normalized_name text:=trim(p_nickname); normalized_body text:=trim(p_body); inserted public.chat_messages;
begin
  if normalized_room !~ '^[a-z0-9_-]{1,32}$' then raise exception 'INVALID_ROOM'; end if;
  if char_length(normalized_name)<1 or char_length(normalized_name)>16 then raise exception 'INVALID_NICKNAME'; end if;
  if char_length(normalized_body)<1 or char_length(normalized_body)>240 then raise exception 'INVALID_MESSAGE'; end if;
  if p_client_token is null then raise exception 'INVALID_CLIENT_TOKEN'; end if;
  if exists(select 1 from public.chat_messages m where m.client_token=p_client_token and m.created_at>now()-interval '1 second') then raise exception 'RATE_LIMITED'; end if;
  delete from public.chat_messages m where m.created_at<now()-interval '24 hours';
  insert into public.chat_messages(room,nickname,body,client_token) values(normalized_room,normalized_name,normalized_body,p_client_token) returning * into inserted;
  return query select inserted.id,inserted.room,inserted.nickname,inserted.body,inserted.created_at;
end;$$;

create or replace function public.get_recent_chat_messages(p_room text,p_limit integer default 50)
returns table(id bigint,room text,nickname text,body text,created_at timestamptz)
language sql security definer set search_path=public as $$
  select x.id,x.room,x.nickname,x.body,x.created_at from(
    select m.id,m.room,m.nickname,m.body,m.created_at from public.chat_messages m
    where m.room=lower(trim(p_room)) and m.created_at>now()-interval '24 hours'
    order by m.id desc limit least(greatest(coalesce(p_limit,50),1),100)
  )x order by x.id asc;
$$;
revoke all on function public.post_chat_message(text,text,text,uuid) from public;
revoke all on function public.get_recent_chat_messages(text,integer) from public;
grant execute on function public.post_chat_message(text,text,text,uuid) to anon,authenticated;
grant execute on function public.get_recent_chat_messages(text,integer) to anon,authenticated;
