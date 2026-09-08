create or replace function public.record_custom_game_score(
  p_submission_id uuid,
  p_game_id text,
  p_mode text,
  p_player_token uuid,
  p_score integer,
  p_duration_ms integer default 0,
  p_room_code text default null,
  p_extra jsonb default '{}'::jsonb
)
returns table(score_id bigint, personal_best integer, global_rank bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_game text := lower(trim(coalesce(p_game_id, '')));
  normalized_mode text := lower(trim(coalesce(p_mode, '')));
  normalized_room text := nullif(upper(trim(coalesce(p_room_code, ''))), '');
  v_id bigint;
  v_best integer;
  v_rank bigint;
begin
  if p_submission_id is null then raise exception 'INVALID_SUBMISSION_ID'; end if;
  if p_player_token is null then raise exception 'INVALID_PLAYER_TOKEN'; end if;
  if normalized_game not in ('fps','shooter','type-attack','puzzle15','stealth16') then raise exception 'INVALID_GAME_ID'; end if;
  if normalized_mode not in ('solo','online') then raise exception 'INVALID_MODE'; end if;
  if p_score is null or p_score < 0 or p_score > 1000000000 then raise exception 'INVALID_SCORE'; end if;
  if p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 3600000 then raise exception 'INVALID_DURATION'; end if;
  if p_extra is null or jsonb_typeof(p_extra) <> 'object' then raise exception 'INVALID_EXTRA'; end if;

  if normalized_mode = 'online' then
    if normalized_room is null or normalized_room !~ '^[A-Z0-9]{6}$' then raise exception 'INVALID_ROOM_CODE'; end if;
    if not exists (
      select 1 from public.game_rooms r
      where r.code = normalized_room
        and r.expires_at > now()
        and lower(coalesce(r.game_id,'')) = normalized_game
    ) then raise exception 'ACTIVE_GAME_ROOM_REQUIRED'; end if;
  else
    normalized_room := null;
  end if;

  select gs.id into v_id
  from public.game_scores gs
  where gs.submission_id = p_submission_id
    and gs.player_token = p_player_token;

  if not found then
    if exists (
      select 1 from public.game_scores gs
      where gs.player_token = p_player_token
        and gs.created_at > now() - interval '2 seconds'
    ) then raise exception 'RATE_LIMITED'; end if;

    insert into public.game_scores(submission_id, game_id, mode, player_token, score, duration_ms, room_code, extra)
    values (p_submission_id, normalized_game, normalized_mode, p_player_token, p_score, p_duration_ms, normalized_room, p_extra)
    returning id into v_id;
  end if;

  select coalesce(max(gs.score), p_score) into v_best
  from public.game_scores gs
  where gs.player_token = p_player_token
    and gs.game_id = normalized_game
    and gs.mode = normalized_mode;

  select count(*) + 1 into v_rank
  from (
    select gs.player_token, max(gs.score) as best_score
    from public.game_scores gs
    where gs.game_id = normalized_game and gs.mode = normalized_mode
    group by gs.player_token
  ) ranked_players
  where ranked_players.best_score > v_best;

  return query select v_id, v_best, coalesce(v_rank, 1);
end;
$$;

revoke all on function public.record_custom_game_score(uuid,text,text,uuid,integer,integer,text,jsonb) from public;
grant execute on function public.record_custom_game_score(uuid,text,text,uuid,integer,integer,text,jsonb) to anon, authenticated;
