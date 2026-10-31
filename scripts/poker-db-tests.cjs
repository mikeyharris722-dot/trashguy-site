const fs = require("node:fs"),
  cp = require("node:child_process");
const container = "trashguy-tier-test-20261029";
const running =
  cp
    .execFileSync(
      "docker",
      ["inspect", "-f", "{{.State.Running}}", container],
      { encoding: "utf8" },
    )
    .trim() === "true";
if (!running) cp.execFileSync("docker", ["start", container]);
try {
  const sql = `BEGIN; ALTER ROLE service_role BYPASSRLS;\n${fs.readFileSync("supabase/migrations/20261031155117_poker_night.sql", "utf8")}\n
 DO $$ BEGIN
 IF has_table_privilege('anon','public.poker_state','SELECT') OR has_table_privilege('authenticated','public.poker_state','SELECT') THEN RAISE EXCEPTION 'Private cards exposed'; END IF;
 IF has_function_privilege('anon','public.poker_commit(bigint,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.poker_commit(bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Public write access'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.poker_state'::regclass) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
 END $$;
 SET LOCAL ROLE service_role;
 DO $$ BEGIN
 IF NOT public.poker_commit(0,'{"enabled":false,"event":null,"receipts":[]}'::jsonb) THEN RAISE EXCEPTION 'Service write failed'; END IF;
 IF public.poker_commit(0,'{}'::jsonb) THEN RAISE EXCEPTION 'Stale write accepted'; END IF;
 IF (SELECT version FROM public.poker_state WHERE id=1) <> 1 THEN RAISE EXCEPTION 'Version incorrect'; END IF;
 END $$;
 RESET ROLE; ROLLBACK;`;
  cp.execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8" },
  );
  console.log(
    "PASS isolated Postgres migration, RLS, private grants, service-only RPC and stale write rejection (transaction rolled back)",
  );
} finally {
  if (!running) cp.execFileSync("docker", ["stop", container]);
}
