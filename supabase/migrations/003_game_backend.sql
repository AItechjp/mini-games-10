create table if not exists public.game_scores (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  game_id text not null check (game_id ~ '^[a-z0-9_-]{1,32}$'),
  mode text not null check (mode in ('solo','online')),
  player_token uuid not null,
  score integer not null check (score between 0 and 1000000000),
  duration_ms integer not null default 0 check (duration_ms between 0 and 3600000),
  room_code text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (room_code is null or room_code ~ '^[A-Z0-9]{6}$'),
  check (jsonb_typeof(extra) = 'object')
);

create index if not exists game_scores_game_mode_score_idx
  on public.game_scores(game_id, mode, score desc, created_at asc);
create index if not exists game_scores_player_game_idx
  on public.game_scores(player_token, game_id, mode, score desc);
create index if not exists game_scores_created_at_idx
  on public.game_scores(created_at desc);

alter table public.game_scores enable row level security;
revoke all on table public.game_scores from public, anon, authenticated;

create or replace function public.record_game_score(
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
  owner_token uuid;
begin
  if p_submission_id is null then raise exception 'INVALID_SUBMISSION_ID'; end if;
  if p_player_token is null then raise exception 'INVALID_PLAYER_TOKEN'; end if;
  if normalized_game !~ '^[a-z0-9_-]{1,32}$' then raise exception 'INVALID_GAME_ID'; end if;
  if normalized_mode not in ('solo','online') then raise exception 'INVALID_MODE'; end if;
  if p_score is null or p_score < 0 or p_score > 1000000000 then raise exception 'INVALID_SCORE'; end if;
  if p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 3600000 then raise exception 'INVALID_DURATION'; end if;
  if normalized_mode = 'online' and (normalized_room is null or normalized_room !~ '^[A-Z0-9]{6}$') then
    raise exception 'INVALID_ROOM_CODE';
  end if;
  if normalized_mode = 'solo' then normalized_room := null; end if;
  if p_extra is null or jsonb_typeof(p_extra) <> 'object' then raise exception 'INVALID_EXTRA'; end if;

  select gs.player_token, gs.id into owner_token, v_id
  from public.game_scores gs
  where gs.submission_id = p_submission_id;

  if found and owner_token <> p_player_token then
    raise exception 'SUBMISSION_ID_TAKEN';
  end if;

  if not found then
    if exists (
      select 1 from public.game_scores gs
      where gs.player_token = p_player_token
        and gs.created_at > now() - interval '2 seconds'
    ) then
      raise exception 'RATE_LIMITED';
    end if;

    insert into public.game_scores(submission_id, game_id, mode, player_token, score, duration_ms, room_code, extra)
    values (p_submission_id, normalized_game, normalized_mode, p_player_token, p_score, p_duration_ms, normalized_room, p_extra)
    returning id into v_id;
  end if;

  select max(gs.score) into v_best
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

  return query select v_id, coalesce(v_best, p_score), coalesce(v_rank, 1);
end;
$$;

revoke all on function public.record_game_score(uuid,text,text,uuid,integer,integer,text,jsonb) from public;
grant execute on function public.record_game_score(uuid,text,text,uuid,integer,integer,text,jsonb) to anon, authenticated;

create or replace function public.get_game_leaderboard(
  p_game_id text,
  p_mode text default 'solo',
  p_limit integer default 10
)
returns table(rank bigint, player_label text, score integer, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with best as (
    select distinct on (gs.player_token)
      gs.player_token, gs.score, gs.created_at
    from public.game_scores gs
    where gs.game_id = lower(trim(p_game_id))
      and gs.mode = lower(trim(p_mode))
    order by gs.player_token, gs.score desc, gs.created_at asc
  ), ranked as (
    select
      dense_rank() over (order by best.score desc) as rank,
      'P-' || upper(substr(md5(best.player_token::text), 1, 6)) as player_label,
      best.score,
      best.created_at
    from best
  )
  select ranked.rank, ranked.player_label, ranked.score, ranked.created_at
  from ranked
  order by ranked.rank asc, ranked.created_at asc
  limit least(greatest(coalesce(p_limit,10),1),50);
$$;

revoke all on function public.get_game_leaderboard(text,text,integer) from public;
grant execute on function public.get_game_leaderboard(text,text,integer) to anon, authenticated;

create or replace function public.get_personal_best(
  p_game_id text,
  p_mode text,
  p_player_token uuid
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(max(gs.score), 0)::integer
  from public.game_scores gs
  where gs.game_id = lower(trim(p_game_id))
    and gs.mode = lower(trim(p_mode))
    and gs.player_token = p_player_token;
$$;

revoke all on function public.get_personal_best(text,text,uuid) from public;
grant execute on function public.get_personal_best(text,text,uuid) to anon, authenticated;

create or replace function public.get_game_backend_overview()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'serverTime', now(),
    'scores24h', (select count(*) from public.game_scores where created_at > now() - interval '24 hours'),
    'activeRooms', (select count(*) from public.game_rooms where expires_at > now()),
    'chat24h', (select count(*) from public.chat_messages where created_at > now() - interval '24 hours')
  );
$$;

revoke all on function public.get_game_backend_overview() from public;
grant execute on function public.get_game_backend_overview() to anon, authenticated;
