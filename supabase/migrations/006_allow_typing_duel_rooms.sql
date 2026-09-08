create or replace function public.create_duel_room(p_code text, p_player_token uuid, p_game_id text)
returns table(code text, role text, player_token uuid, channel_key uuid, game_id text)
language plpgsql security definer set search_path = public as $$
declare normalized text := upper(trim(p_code)); normalized_game text := lower(trim(p_game_id)); created public.game_rooms;
begin
  if normalized !~ '^[A-Z0-9]{6}$' then raise exception 'INVALID_ROOM_CODE'; end if;
  if p_player_token is null then raise exception 'INVALID_PLAYER_TOKEN'; end if;
  if normalized_game not in ('fps','shooter','type-attack') then raise exception 'INVALID_GAME_ID'; end if;
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
  if normalized_game not in ('fps','shooter','type-attack') then raise exception 'INVALID_GAME_ID'; end if;
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
