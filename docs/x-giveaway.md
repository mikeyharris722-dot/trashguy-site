# X giveaway

The admin Twitter/X Giveaway workspace reuses the Trash Cash wheel. Records,
participant snapshots and uniform server-selected draws are separate from chat
giveaways. CSV/manual imports support up to 200 eligible accounts. Collection
uses direct replies only, stable author IDs and explicit source-post validation.

Apply `database/x-giveaway-setup.sql` and `database/x-collector-vault.sql` before
release. Both were applied to the existing Trash Supabase project. RLS is enabled
and browser roles have no table or RPC access. The collector RPC uses invoker
permissions and reads one fixed Vault secret; it is executable only by service_role.

Store `trash_x_collector_config` through the Supabase Vault UI, with JSON fields
`token` (the actor-scoped Apify token) and `freePlanConfirmed` (boolean). Never
commit its value or include it in SQL, query history, client responses or logs.
The existing server Supabase credential reads this configuration. Local environment
variables APIFY_API_TOKEN / APIFY_FREE_PLAN_CONFIRMED take precedence when present.
No Vercel environment change is required for the Vault path.

Collection is capped at 20 rows/run, 60 site reservations/calendar month, $0.05
maximum charge/run and a $3 scoped actor usage guard. The original no-card Free
account was verified in Console; the scoped token cannot dynamically inspect
whole-account billing or subscription changes. A result reaching the row limit
blocks drawing until a complete CSV is imported. Results cache for five minutes;
ambiguous starts are not repeated automatically. Hidden or unavailable replies
may be missing. No claim of complete coverage is made.

Token renewal is required before its 17 February 2027 expiry. Update the dedicated
Vault secret through the UI; no redeployment is needed. Keep free-plan settings
and token scope unchanged unless separately authorized.

Checks: production-mode build, TypeScript, targeted lint, X import/draw tests,
collection and Vault configuration tests, unchanged Trash Cash tests, production
server storage read/stale-write rejection and denied anonymous secret access.
Local fixtures never seed production state.
