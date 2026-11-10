-- Preserve the existing command's row lock, request ownership and queue guards.
create function public.claw_production_seafoam(p_actor uuid,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.claw_production_state%rowtype;v jsonb;begin
 select * into strict s from public.claw_production_state where id=true for update;
 if s.event_id=p_request and s.clip<>'seafoam' then raise exception 'Production request belongs to another clip';end if;
 v:=public.claw_production_command(p_actor,'play',p_request);
 update public.claw_production_state set clip='seafoam',duration_ms=25010,volume=1 where id=true;
 return jsonb_set(jsonb_set(jsonb_set(v,'{clip}','"seafoam"'::jsonb),'{durationMs}','25010'::jsonb),'{volume}','1'::jsonb);
end;$$;
revoke all on function public.claw_production_seafoam(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claw_production_seafoam(uuid,uuid) to service_role;
