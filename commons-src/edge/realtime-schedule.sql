-- Supabase project with pg_cron and pg_net already enabled.
-- Both public endpoints use a database lock and a bounded collection batch.
select cron.schedule(
  'commons-official-evidence-five-minutes',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := 'https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-realtime/directory',
    timeout_milliseconds := 35000
  );
  select net.http_get(
    url := 'https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-realtime/openings',
    timeout_milliseconds := 35000
  );
  $job$
);
