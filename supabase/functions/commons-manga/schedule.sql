-- Enable only after deploying the function. The private token stays in Vault.
create or replace function public.commons_manga_tick() returns bigint language plpgsql security invoker set search_path='' as $$
declare request_id bigint;
begin
 delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname='commons-manga-five-minutes') and end_time<now()-interval '7 days';
 select net.http_post(
  url:='https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-manga',
  headers:=jsonb_build_object('Content-Type','application/json','x-manga-token',(select decrypted_secret from vault.decrypted_secrets where name='commons_manga_cron')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.commons_manga_tick() from public,anon,authenticated,service_role;
select cron.schedule('commons-manga-five-minutes','*/5 * * * *','select public.commons_manga_tick();');
