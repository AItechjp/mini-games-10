create table if not exists public.commons_phone_cache (
 id smallint primary key check (id=1),
 payload jsonb,
 refresh_after timestamptz not null default 'epoch',
 updated_at timestamptz
);
alter table public.commons_phone_cache enable row level security;
revoke all on public.commons_phone_cache from public, anon, authenticated;
grant select, insert, update on public.commons_phone_cache to service_role;
insert into public.commons_phone_cache(id) values(1) on conflict(id) do nothing;
