-- Durable community state and atomic, replay-safe server commands.
-- Clients never access these tables directly; Next route handlers authenticate
-- the user and enforce participant/admin rules before the service-role call.
create table public.community_documents (
  id text primary key check (id in ('hunts','catalogue')),
  payload jsonb not null,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  check (octet_length(payload::text) <= 20000000),
  check ((id='hunts' and jsonb_typeof(payload)='object'
    and jsonb_typeof(payload->'hunts')='array'
    and jsonb_typeof(payload->'activeHuntId')='string')
    or (id='catalogue' and jsonb_typeof(payload)='array'))
);
create table public.community_requests (
  request_id uuid primary key,
  actor_id uuid not null,
  document text not null references public.community_documents(id),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.community_documents enable row level security;
alter table public.community_requests enable row level security;
revoke all on public.community_documents, public.community_requests from public, anon, authenticated;
grant select, insert, update on public.community_documents to service_role;
grant select, insert on public.community_requests to service_role;
insert into public.community_documents(id,payload) values
 ('hunts','{"hunts":[],"activeHuntId":""}'::jsonb), ('catalogue','[]'::jsonb);

create function public.community_commit(
  p_document text, p_expected bigint, p_payload jsonb, p_actor uuid,
  p_request uuid, p_fingerprint text, p_result jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_version bigint;
  previous public.community_requests%rowtype;
begin
  -- This short transaction holds the lock only during the final write.
  select version into current_version from public.community_documents
    where id=p_document for update;
  if not found then raise exception 'Community storage is missing'; end if;
  select * into previous from public.community_requests where request_id=p_request;
  if found then
    if previous.actor_id <> p_actor or previous.document <> p_document
       or previous.fingerprint <> p_fingerprint then
      raise exception 'Request ID already used for another action';
    end if;
    return jsonb_build_object('committed',true,'result',previous.result);
  end if;
  if current_version <> p_expected then
    return jsonb_build_object('committed',false,'result',null);
  end if;
  if p_actor is null or p_request is null or p_result is null then
    raise exception 'Missing command identity';
  end if;
  update public.community_documents set payload=p_payload,
    version=version+1,updated_at=now() where id=p_document;
  insert into public.community_requests(request_id,actor_id,document,fingerprint,result)
    values(p_request,p_actor,p_document,p_fingerprint,p_result);
  return jsonb_build_object('committed',true,'result',p_result);
end;
$$;
revoke all on function public.community_commit(text,bigint,jsonb,uuid,uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.community_commit(text,bigint,jsonb,uuid,uuid,text,jsonb) to service_role;
comment on table public.community_documents is 'Server-only community hunt state. CAS version prevents lost updates across Vercel instances.';
comment on table public.community_requests is 'Server-only command receipts. A repeated request cannot duplicate registration, calls or payouts.';
