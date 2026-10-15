CREATE TABLE public.claw_production_state(id boolean PRIMARY KEY DEFAULT true CHECK(id),event_id uuid,started_at timestamptz,actor uuid);
INSERT INTO public.claw_production_state(id) VALUES(true);
ALTER TABLE public.claw_production_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.claw_production_state FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.claw_production_state TO service_role;
CREATE FUNCTION public.claw_production_command(p_actor uuid,p_action text,p_request uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE state public.claw_production_state%rowtype;BEGIN
 IF p_actor IS NULL OR p_action NOT IN ('play','stop') OR p_action IS NULL OR (p_action='play' AND p_request IS NULL) THEN RAISE EXCEPTION 'Invalid production command';END IF;
 SELECT * INTO STRICT state FROM public.claw_production_state WHERE id=true FOR UPDATE;
 IF p_action='stop' THEN UPDATE public.claw_production_state SET event_id=NULL,started_at=NULL,actor=p_actor WHERE id=true;RETURN NULL;END IF;
 IF state.event_id=p_request THEN IF state.actor IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Production request belongs to another admin';END IF;RETURN jsonb_build_object('id',state.event_id,'startedAt',state.started_at,'durationMs',10000);END IF;
 IF state.started_at>now()-interval '10 seconds' THEN RAISE EXCEPTION 'Production is already playing';END IF;
 UPDATE public.claw_production_state SET event_id=p_request,started_at=now(),actor=p_actor WHERE id=true RETURNING * INTO state;
 RETURN jsonb_build_object('id',state.event_id,'startedAt',state.started_at,'durationMs',10000);
END;$$;
REVOKE ALL ON FUNCTION public.claw_production_command(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claw_production_command(uuid,text,uuid) TO service_role;
