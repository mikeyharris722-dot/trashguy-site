# Poker Night

Free-entry no-limit Texas Hold’em tournaments. Chips have no cash value. Poker is isolated from hunts, slot calls, giveaways, overlays and reward balances.

## Controls

- Public page: `/#poker`. Twitch sign-in is required to register or play; spectators can watch without signing in.
- Admin hub → Poker Night: enable/hide the public event, create an event, approve sign-ups, add existing registered players, remove players before starting, close registration, start, pause, resume or end play. Ending during a hand returns its committed chips and keeps private cards hidden.
- Configure starting chips, 2–9 seats per table, starting small blind, blind levels by time (minutes) or completed hands, increase multiplier (1.5×, 2× or 3×) and turn timer. The Poker Settings panel can edit these during registration; they lock when play starts. Up to 90 entries, approval required. Registration ends at start; no late entries or rebuys.
- Hand-for-hand rounds: all tables finish their current hand before the next round. Seats and dealer rotation remain stable until balancing is needed. Tables combine as players bust, ending at one final table. In hand-based mode, a hand means a synchronized tournament round, not the sum of deals at separate tables.
- Turns time out to check if no bet is owed, otherwise fold. Returning players reload the same private cards and chips. Disconnected players continue posting blinds and timing out.
- Simultaneous eliminations are ranked by starting stack for that hand, with equal stacks tied. Blind increases take effect on the next deal. Hide Poker Night also removes its public menu item. Tournaments and Community Hunts each have independent show/hide controls in their admin workspace; both remain accessible to admins.
- The completed event remains visible until an admin creates its replacement. This initial version keeps one event, not a historical tournament archive.

## Local preview

Start with `POKER_LOCAL=1` in a non-production environment. Poker writes only `.local/poker-state.json`. The review proxy permits that exact endpoint only when this flag is on and NODE_ENV is not production. No test authentication bypass exists; normal Twitch/admin checks still apply.

Do not run build and development servers concurrently against the same `.next` output. Restart the development server after a build.

## Persistence and security

Apply `supabase/migrations/20261031155117_poker_night.sql` before deploying. It creates a separate private singleton state table and service-only compare-and-swap function. RLS is enabled and anon/authenticated grants are revoked. The server uses the existing service role; never expose it in the browser. No existing data or schema is modified.

Private decks, burn cards and other players’ hole cards are excluded from every API response, including admin views. Showdown reveals only non-folded hands; uncontested winners keep cards private. Cards are shuffled using Node crypto, not browser randomness.

Commands revalidate Twitch identity and admin actions additionally revalidate admin permissions. A bounded 20-second identity cache is used only for reads and never past token expiry. Shared state reads are coalesced/cached for 750 ms; private responses are projected separately per viewer and never CDN-cached. Writes always read fresh state.

Each action has an actor-bound idempotency key. Database versions protect concurrent writes; per-turn tokens reject stale clicks while allowing independent tables to act concurrently. Conflicts are retried up to three times for gameplay/timer actions, then require refresh. Settings commands require the exact event version.

The active poker screen polls serially every 2 seconds during play, otherwise 10 seconds, backs off after errors and stops polling when hidden/unmounted. Server deadlines advance through authenticated tick requests from active viewers. There is no dedicated always-on game worker: if every signed-in viewer closes the page, progress resumes when someone returns. Timeouts remain server-authoritative.

## Verification

- `npm run test:poker`: rankings, wheel straights, seven-card evaluation, heads-up order, shuffle uniqueness, side pots, uncalled bets, split pots, short all-ins, timing, pauses, blind clock, seating, full multi-table simulations, private projections, API authorization, idempotency, stale events/turns, concurrent tables and actual local-store compare-and-swap.
- `node scripts/poker-db-tests.cjs`: uses only the named disposable local Docker Postgres container and rolls back the migration and security assertions. Does not read live credentials.
- `npx tsc --noEmit`, scoped ESLint and `npm run build`.
- Existing hunt isolation, tracker, claw-production and Twitch-points regression suites.
- Browser check: existing admin session, local tournament controls, registered-user search, desktop/mobile layouts and overflow.

Before a public tournament, test with at least two independent signed-in accounts and qualify expected concurrent traffic on a preview environment. Engine simulations and mocked API concurrency tests do not establish production hosting capacity. Keep disabled until those release checks and migration deployment are complete.

## Release checks · 31 October 2026

Production migration applied with migration history entry `20261031155117`. Verified RLS enabled, anon/authenticated table access revoked, anon function execution denied and service-only CAS available. Production Data API checks confirmed the new event is empty/hidden and a stale write returns false without modifying state.

Release tests passed: poker engine/API/local store, isolated Postgres security/CAS, site review/visibility, Community Hunt, hunt isolation, tracker/catalogue matching, claw production, Twitch-points/webhook/stop handling, Discord slot board, TypeScript, scoped ESLint and production build. Randomized engine simulations include 90 players. The existing local-only Community Hunt file-tracing build warning remains unchanged.

No real-account multi-player or peak-traffic qualification has been completed. Keep Poker Night hidden until a two-account playtest and expected-concurrency preview check are complete. Existing hunts/giveaways/overlays are not migrated or reset by this release.
