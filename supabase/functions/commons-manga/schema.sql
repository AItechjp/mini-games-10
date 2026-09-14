create table if not exists public.commons_manga_state (
 id integer primary key check(id=1),
 payload jsonb not null default '{"sources":[],"items":[]}'::jsonb check(octet_length(payload::text)<=1800000),
 token_hash text not null,
 started_at timestamptz, completed_at timestamptz,
 lease_until timestamptz, lease_owner uuid, last_error text
);
alter table public.commons_manga_state enable row level security;
revoke all on public.commons_manga_state from public,anon,authenticated;
grant select,insert,update on public.commons_manga_state to service_role;
do $$ declare token text; begin
 if not exists(select 1 from vault.secrets where name='commons_manga_cron') then
  token:=encode(extensions.gen_random_bytes(32),'hex');
  perform vault.create_secret(token,'commons_manga_cron','Private official manga feed collection');
 else
  select decrypted_secret into token from vault.decrypted_secrets where name='commons_manga_cron';
 end if;
 insert into public.commons_manga_state(id,token_hash) values(1,encode(extensions.digest(token,'sha256'),'hex')) on conflict(id) do nothing;
end $$;
create or replace function public.commons_manga_claim(p_owner uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.commons_manga_state set lease_until=now()+interval '75 seconds',lease_owner=p_owner,started_at=now(),last_error=null
 where id=1 and (lease_until is null or lease_until<now()) and (started_at is null or started_at<now()-interval '250 seconds');
 return found;
end $$;
revoke all on function public.commons_manga_claim(uuid) from public,anon,authenticated;
grant execute on function public.commons_manga_claim(uuid) to service_role;
