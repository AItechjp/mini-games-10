create or replace function public.cyber_read(p_query text default '',p_source text default '',p_category text default '',p_before timestamptz default null,p_before_id text default '',p_limit integer default 60)
returns jsonb language sql stable security invoker set search_path='' as $$
with visible as (
 select a.* from public.cyber_articles a where a.expires_at>now() and a.published_at<=now()
), filtered as (
 select a.* from visible a where a.title_ja is not null
 and (p_source='' or a.source_id=p_source) and (p_category='' or a.category=p_category)
 and (p_query='' or position(lower(left(p_query,120)) in lower(coalesce(a.title_ja,'')||' '||a.title_original||' '||coalesce(a.body_ja,'')))>0)
), page as (
 select a.id,a.source_id,a.url,a.title_ja,left(coalesce(a.body_ja,''),240) as excerpt,a.published_at,a.expires_at,a.category,a.language,a.date_basis,a.translation_status,a.body_truncated
 from filtered a where p_before is null or (a.published_at,a.id)<(p_before,p_before_id)
 order by a.published_at desc,a.id desc limit least(greatest(p_limit,1),80)
), counts as (
 select source_id,count(*) as article_count,count(*) filter(where title_ja is not null) as translated_count from visible group by source_id
)
select jsonb_build_object(
 'now',now(),'retention_hours',72,'refresh_seconds',60,
 'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.published_at desc,p.id desc) from page p),'[]'::jsonb),
 'total',(select count(*) from filtered),
 'stats',jsonb_build_object('articles',(select count(*) from visible),'ready',(select count(*) from visible where translation_status='ready'),'pending',(select count(*) from visible where translation_status<>'ready'),'sources',(select count(*) from public.cyber_sources where enabled),'healthy',(select count(*) from public.cyber_sources where enabled and error is null and last_ok_at is not null),'last_started_at',(select last_started_at from public.cyber_control where id=1),'last_completed_at',(select last_completed_at from public.cyber_control where id=1),'last_error',(select last_error from public.cyber_control where id=1),'translation_error',(select translation_error from public.cyber_control where id=1)),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'website',s.website,'feed_url',s.feed_url,'language',s.language,'category',s.category,'provenance',s.provenance,'last_checked_at',s.last_checked_at,'last_ok_at',s.last_ok_at,'next_check_at',s.next_check_at,'http_status',s.http_status,'error',s.error,'latest_article_at',s.latest_article_at,'count',coalesce(c.article_count,0),'translated',coalesce(c.translated_count,0),'skipped_undated',s.skipped_undated) order by s.rank) from public.cyber_sources s left join counts c on s.id=c.source_id where s.enabled),'[]'::jsonb)
);
$$;
revoke all on function public.cyber_read(text,text,text,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.cyber_read(text,text,text,timestamptz,text,integer) to service_role;
