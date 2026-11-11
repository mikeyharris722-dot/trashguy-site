create extension if not exists pg_cron;
create extension if not exists http with schema extensions;

create or replace function public.refresh_discord_leaderboard()
returns void
language plpgsql
set search_path = ''
as $$
declare
  webhook text;
  board extensions.http_response;
  discord_status integer;
begin
  select decrypted_secret into strict webhook
  from vault.decrypted_secrets
  where name = 'discord_leaderboard_webhook';

  if webhook !~ '^https://discord[.]com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception 'Invalid Discord leaderboard webhook';
  end if;

  perform set_config('http.curlopt_timeout_msec', '10000', true);
  perform set_config('http.curlopt_connecttimeout_msec', '3000', true);
  select * into board from extensions.http_get('https://trashguy.me/api/leaderboard?format=discord');
  if board.status <> 200 then
    raise exception 'Leaderboard API returned HTTP %', board.status;
  end if;
  if jsonb_typeof(board.content::jsonb->'embeds') is distinct from 'array' then
    raise exception 'Leaderboard API did not return a Discord embed';
  end if;

  begin
    select response.status into discord_status
    from extensions.http(row(
      'PATCH', webhook || '/messages/1570066488717607003', null,
      'application/json', board.content
    )::extensions.http_request) as response;
  exception when others then
    raise exception 'Discord leaderboard request failed';
  end;
  if discord_status <> 200 then
    raise exception 'Discord leaderboard returned HTTP %', discord_status;
  end if;
end;
$$;

revoke all on function public.refresh_discord_leaderboard() from public, anon, authenticated;

-- Enable after adding discord_leaderboard_webhook to Vault and testing the function:
-- select cron.schedule('discord-leaderboard', '*/5 * * * *', 'select public.refresh_discord_leaderboard()');
