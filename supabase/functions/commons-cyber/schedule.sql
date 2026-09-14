create or replace function public.cyber_tick() returns bigint language plpgsql security invoker set search_path='' as $$
declare request_id bigint;
begin
 delete from public.cyber_articles where expires_at<=now();
 delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname='commons-cyber-every-minute') and end_time<now()-interval '72 hours';
 select net.http_post(
   url:='https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-cyber',
   headers:=jsonb_build_object('Content-Type','application/json','x-cyber-token',(select decrypted_secret from vault.decrypted_secrets where name='commons_cyber_cron')),
   body:='{}'::jsonb,timeout_milliseconds:=65000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.cyber_tick() from public,anon,authenticated,service_role;
select cron.schedule('commons-cyber-every-minute','* * * * *','select public.cyber_tick();');
