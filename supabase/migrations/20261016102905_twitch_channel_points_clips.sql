-- Prepared locally; apply only with the matching application release.
CREATE TABLE public.twitch_points_config (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 reward_id text NOT NULL DEFAULT '', volume numeric NOT NULL DEFAULT 1 CHECK(volume BETWEEN 0 AND 1),
 broadcaster_id text, broadcaster_login text, tokens text,
 subscription_id text, subscription_status text, chat_subscription_id text, chat_subscription_status text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.twitch_points_config(id) VALUES(true);
CREATE TABLE public.twitch_points_invites (
 token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE public.twitch_points_receipts (
 redemption_id text PRIMARY KEY, viewer text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL, event_id uuid
);
CREATE INDEX twitch_points_receipts_received ON public.twitch_points_receipts(received_at DESC);
ALTER TABLE public.twitch_points_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitch_points_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitch_points_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.twitch_points_config,public.twitch_points_invites,public.twitch_points_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.twitch_points_config,public.twitch_points_invites,public.twitch_points_receipts TO service_role;
ALTER TABLE public.claw_production_state ADD COLUMN clip text NOT NULL DEFAULT 'claw', ADD COLUMN volume numeric NOT NULL DEFAULT 0.7 CHECK(volume BETWEEN 0 AND 1), ADD COLUMN duration_ms integer NOT NULL DEFAULT 10000, ADD COLUMN queue jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(queue)='array');

CREATE FUNCTION public.twitch_points_enqueue(p_redemption text,p_viewer text,p_broadcaster text,p_reward text,p_event uuid) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.claw_production_state%rowtype; c public.twitch_points_config%rowtype; outcome text; added integer;
BEGIN
 SELECT * INTO STRICT s FROM public.claw_production_state WHERE id=true FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.twitch_points_receipts WHERE redemption_id=p_redemption) THEN RETURN 'duplicate'; END IF;
 SELECT * INTO STRICT c FROM public.twitch_points_config WHERE id=true;
 outcome := CASE WHEN NOT c.enabled OR c.broadcaster_id IS DISTINCT FROM p_broadcaster OR c.reward_id IS DISTINCT FROM p_reward THEN 'ignored' WHEN jsonb_array_length(s.queue)>=20 THEN 'queue_full' ELSE 'queued' END;
 INSERT INTO public.twitch_points_receipts(redemption_id,viewer,status,event_id) VALUES(p_redemption,left(p_viewer,100),outcome,p_event) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 IF added=0 THEN RETURN 'duplicate'; END IF;
 IF outcome='queued' THEN UPDATE public.claw_production_state SET queue=queue||jsonb_build_array(jsonb_build_object('id',p_event,'redemption',p_redemption,'queuedAt',now(),'volume',c.volume)) WHERE id=true; END IF;
 RETURN outcome;
END;$$;

CREATE FUNCTION public.twitch_points_next() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.claw_production_state%rowtype; item jsonb; enabled boolean;
BEGIN
 SELECT * INTO STRICT s FROM public.claw_production_state WHERE id=true FOR UPDATE;
 IF s.started_at IS NOT NULL AND s.started_at + s.duration_ms*interval '1 millisecond' > now() THEN RETURN NULL; END IF;
 SELECT c.enabled INTO enabled FROM public.twitch_points_config c WHERE id=true;
 WHILE jsonb_array_length(s.queue)>0 LOOP
  item:=s.queue->0; s.queue:=s.queue-0;
  IF NOT enabled OR (item->>'queuedAt')::timestamptz < now()-interval '15 minutes' THEN
   UPDATE public.twitch_points_receipts SET status=CASE WHEN enabled THEN 'expired' ELSE 'cancelled' END WHERE redemption_id=item->>'redemption';
   CONTINUE;
  END IF;
  UPDATE public.claw_production_state SET queue=s.queue,event_id=(item->>'id')::uuid,started_at=now()+interval '1 second',actor=NULL,clip='scotland',volume=(item->>'volume')::numeric,duration_ms=68105 WHERE id=true;
  UPDATE public.twitch_points_receipts SET status='started' WHERE redemption_id=item->>'redemption';
  RETURN jsonb_build_object('id',item->>'id','startedAt',now()+interval '1 second','durationMs',68105,'clip','scotland','volume',(item->>'volume')::numeric);
 END LOOP;
 UPDATE public.claw_production_state SET queue=s.queue WHERE id=true;
 RETURN NULL;
END;$$;

CREATE OR REPLACE FUNCTION public.claw_production_command(p_actor uuid,p_action text,p_request uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.claw_production_state%rowtype;
BEGIN
 IF p_actor IS NULL OR p_action NOT IN ('play','stop') OR p_action IS NULL OR (p_action='play' AND p_request IS NULL) THEN RAISE EXCEPTION 'Invalid production command'; END IF;
 SELECT * INTO STRICT s FROM public.claw_production_state WHERE id=true FOR UPDATE;
 IF p_action='stop' THEN
  UPDATE public.twitch_points_receipts SET status='cancelled' WHERE status='queued' OR (status='started' AND event_id=s.event_id);
  UPDATE public.claw_production_state SET event_id=NULL,started_at=NULL,actor=p_actor,queue='[]' WHERE id=true; RETURN NULL;
 END IF;
 IF s.event_id=p_request THEN
  IF s.actor IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Production request belongs to another admin'; END IF;
  RETURN jsonb_build_object('id',s.event_id,'startedAt',s.started_at,'durationMs',s.duration_ms,'clip',s.clip,'volume',s.volume);
 END IF;
 IF s.started_at+s.duration_ms*interval '1 millisecond'>now() OR jsonb_array_length(s.queue)>0 THEN RAISE EXCEPTION 'Production is playing or a channel-point clip is queued. Stop playback to clear the queue.'; END IF;
 UPDATE public.claw_production_state SET event_id=p_request,started_at=now(),actor=p_actor,clip='claw',volume=0.7,duration_ms=10000 WHERE id=true;
 RETURN jsonb_build_object('id',p_request,'startedAt',now(),'durationMs',10000,'clip','claw','volume',0.7);
END;$$;
REVOKE ALL ON FUNCTION public.twitch_points_enqueue(text,text,text,text,uuid),public.twitch_points_next() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.twitch_points_enqueue(text,text,text,text,uuid),public.twitch_points_next() TO service_role;
REVOKE ALL ON FUNCTION public.claw_production_command(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claw_production_command(uuid,text,uuid) TO service_role;

CREATE FUNCTION public.twitch_points_disable() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.claw_production_state%rowtype;
BEGIN
 SELECT * INTO STRICT s FROM public.claw_production_state WHERE id=true FOR UPDATE;
 UPDATE public.twitch_points_config SET enabled=false,updated_at=now() WHERE id=true;
 UPDATE public.twitch_points_receipts SET status='cancelled' WHERE status='queued' OR (s.clip='scotland' AND status='started' AND event_id=s.event_id);
 UPDATE public.claw_production_state SET queue='[]',event_id=CASE WHEN clip='scotland' THEN NULL ELSE event_id END,started_at=CASE WHEN clip='scotland' THEN NULL ELSE started_at END WHERE id=true;
END;$$;
REVOKE ALL ON FUNCTION public.twitch_points_disable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.twitch_points_disable() TO service_role;

-- Stop commands have their own receipt so Twitch retries cannot stop a later video.
CREATE FUNCTION public.twitch_points_stop_chat(p_message text,p_viewer text,p_broadcaster text) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.claw_production_state%rowtype; added integer;
BEGIN
 SELECT * INTO STRICT s FROM public.claw_production_state WHERE id=true FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.twitch_points_config WHERE id=true AND broadcaster_id=p_broadcaster) THEN RETURN 'ignored'; END IF;
 INSERT INTO public.twitch_points_receipts(redemption_id,viewer,status) VALUES('chat-stop:'||p_message,left(p_viewer,100),'stopped') ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;IF added=0 THEN RETURN 'duplicate';END IF;
 UPDATE public.twitch_points_receipts SET status='cancelled' WHERE status='queued' OR (status='started' AND event_id=s.event_id AND s.started_at+s.duration_ms*interval '1 millisecond'>now());
 UPDATE public.claw_production_state SET event_id=NULL,started_at=NULL,actor=NULL,queue='[]' WHERE id=true;
 RETURN 'stopped';
END;$$;
REVOKE ALL ON FUNCTION public.twitch_points_stop_chat(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.twitch_points_stop_chat(text,text,text) TO service_role;
