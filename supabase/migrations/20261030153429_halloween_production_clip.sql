-- Preserve the existing command's row lock, request ownership and queue guards.
create function public.claw_production_halloween(p_actor uuid,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.claw_production_state%rowtype;v jsonb;begin
 select * into strict s from public.claw_production_state where id=true for update;
 if s.event_id=p_request and s.clip<>'halloween' then raise exception 'Production request belongs to another clip';end if;
 v:=public.claw_production_command(p_actor,'play',p_request);
 update public.claw_production_state set clip='halloween',duration_ms=30000,volume=0.85 where id=true;
 return jsonb_set(jsonb_set(jsonb_set(v,'{clip}','"halloween"'::jsonb),'{durationMs}','30000'::jsonb),'{volume}','0.85'::jsonb);
end;$$;
revoke all on function public.claw_production_halloween(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claw_production_halloween(uuid,uuid) to service_role;
