create table if not exists public.arcade_rooms (
 code text primary key check(code ~ '^[A-HJ-NP-Z2-9]{6}$'),
 game text not null, host_hash text not null check(length(host_hash)=64),
 topic text not null, members jsonb not null, state jsonb,
 revision integer not null default 0,
 status text not null default 'waiting' check(status in ('waiting','playing','finished','closed')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '6 hours',
 checkpoint_at timestamptz
);
alter table public.arcade_rooms enable row level security;
revoke all on public.arcade_rooms from anon,authenticated;
grant select,insert,update,delete on public.arcade_rooms to service_role;
create index if not exists arcade_rooms_expiry_idx on public.arcade_rooms(expires_at);
create index if not exists arcade_rooms_host_idx on public.arcade_rooms(host_hash,created_at desc);
create table if not exists public.arcade_rate_limits(bucket text primary key,hits integer not null default 1,expires_at timestamptz not null);
alter table public.arcade_rate_limits enable row level security;
revoke all on public.arcade_rate_limits from anon,authenticated;
grant select,insert,update,delete on public.arcade_rate_limits to service_role;
create index if not exists arcade_rate_expiry_idx on public.arcade_rate_limits(expires_at);
create or replace function public.arcade_take_rate(p_bucket text,p_limit integer,p_expires timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.arcade_rate_limits(bucket,hits,expires_at) values(p_bucket,1,p_expires)
 on conflict(bucket) do update set hits=public.arcade_rate_limits.hits+1 returning hits into n;
 return n<=p_limit;
end;
$$;
revoke execute on function public.arcade_take_rate(text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.arcade_take_rate(text,integer,timestamptz) to service_role;
