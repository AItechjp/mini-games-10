-- All mutation paths are private. Public reads go through the bounded Edge API.
create extension if not exists pg_net;
create table if not exists public.cyber_sources (
 id text primary key, name text not null, website text not null, feed_url text not null,
 language text not null, category text not null, provenance text not null, rank integer not null default 0,
 enabled boolean not null default true, last_checked_at timestamptz, last_ok_at timestamptz,
 next_check_at timestamptz not null default now(), http_status integer, error text,
 failures integer not null default 0, etag text, last_modified text, latest_article_at timestamptz,
 recent_count integer not null default 0, skipped_undated integer not null default 0
);
create table if not exists public.cyber_articles (
 id text primary key, source_id text not null references public.cyber_sources(id),
 url text unique not null, title_original text not null, body_original text not null default '',
 title_ja text, body_ja text, language text not null, category text not null,
 published_at timestamptz not null, fetched_at timestamptz not null default now(),
 expires_at timestamptz not null, date_basis text not null default 'published',
 body_truncated boolean not null default false, translation_status text not null default 'pending',
 translation_attempts integer not null default 0, translation_error text, translated_at timestamptz,
 next_translation_at timestamptz not null default now(), translator text,
 check (expires_at = published_at + interval '72 hours'),
 check (char_length(title_original) <= 600 and char_length(body_original) <= 3000)
);
create index if not exists cyber_articles_published_idx on public.cyber_articles(published_at desc, id);
create index if not exists cyber_articles_expiry_idx on public.cyber_articles(expires_at);
create index if not exists cyber_articles_source_date_idx on public.cyber_articles(source_id,published_at desc);
create index if not exists cyber_articles_translation_idx on public.cyber_articles(next_translation_at,published_at desc) where translation_status <> 'ready';
create table if not exists public.cyber_control (
 id integer primary key check(id=1), token_hash text not null, lease_until timestamptz,
 last_started_at timestamptz, last_completed_at timestamptz, last_error text,
 scan_count integer not null default 0, translation_error text, last_translation_at timestamptz
);
alter table public.cyber_sources enable row level security;
alter table public.cyber_articles enable row level security;
alter table public.cyber_control enable row level security;
revoke all on public.cyber_sources,public.cyber_articles,public.cyber_control from public,anon,authenticated;
grant select,insert,update,delete on public.cyber_sources,public.cyber_articles,public.cyber_control to service_role;
-- The secret is generated and remains in Vault; it is never written to source or returned.
do $$ declare token text; begin
 if not exists(select 1 from vault.secrets where name='commons_cyber_cron') then
  token:=encode(extensions.gen_random_bytes(32),'hex');
  perform vault.create_secret(token,'commons_cyber_cron','Private news collector cron authentication');
 else
  select decrypted_secret into token from vault.decrypted_secrets where name='commons_cyber_cron';
 end if;
 insert into public.cyber_control(id,token_hash) values(1,encode(extensions.digest(token,'sha256'),'hex')) on conflict(id) do nothing;
end $$;
create or replace function public.cyber_claim() returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.cyber_control set lease_until=now()+interval '100 seconds',last_started_at=now(),last_error=null
 where id=1 and (lease_until is null or lease_until<now()) and (last_started_at is null or last_started_at<now()-interval '50 seconds');
 return found;
end $$;
revoke all on function public.cyber_claim() from public,anon,authenticated;
grant execute on function public.cyber_claim() to service_role;
-- Scheduling is enabled after the collector deployment has passed its first live check.
