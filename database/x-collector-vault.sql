-- Reads only the dedicated collector secret. Store its value through Vault UI,
-- never in SQL, source control, query history or an exposed application table.
begin;
create or replace function public.x_collector_config()
returns jsonb language sql stable security invoker set search_path='' as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets
  where name='trash_x_collector_config' limit 1;
$$;
revoke all on function public.x_collector_config() from public,anon,authenticated;
grant execute on function public.x_collector_config() to service_role;
commit;
