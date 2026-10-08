# Community Hunt: live operation and isolated local testing

Community Hunt is available in the public three-line menu and Admin > Community Hunt. It uses Rainbet; the existing picker, Twitch viewer calls and ordinary hunts keep Roulobets.

## Run a hunt

1. An existing admin creates a hunt and chooses the number of queued calls allowed per player. Starting bankroll is initially zero.
2. A viewer signs in with Twitch, enters their contribution and requests to join. An admin approves or declines it. Only approved contributions count towards the starting bankroll; this records equity and does not transfer money.
3. Approved players select a Rainbet catalogue slot and submit a call. Admins can add host calls. Duplicate queued or collected slots are rejected.
4. Admins pick a random call, optionally open its stored Rainbet link and record Passed with the bet size or Failed. This releases the caller's queued call space. The site does not place bets or infer game outcomes.
5. Passed bonuses appear in the shared Bonus Hunt Tracker. Choose the community hunt in that selector to manage bet sizes, tiers, notes and ordering. Manual entry uses Rainbet for community hunts. Ordinary hunts keep their existing catalogue and commands.
6. Opening runs through the saved order. Skip moves a pending bonus to the end. Enter each payout and confirm; all payouts are required before finishing. Registration and new calls are closed while opening.
7. OBS uses `/overlay` at 435 x 285 and follows the active hunt. Collection scrolls; opening shows the current queue and latest payout without scrolling. Selecting an ordinary hunt switches the overlay back. `/overlay?community=1` explicitly shows the selected community hunt.
8. Deleting a hunt hides it; its database snapshot is retained for owner recovery. Notes and individual contributions are restricted to admins, with each player able to see their own contribution. Public pages show approved names and aggregate bankroll.

## Rainbet catalogue

The initial snapshot contains 4,088 source records and canonical Rainbet links. Admin > Community Hunt > Rainbet catalogue sits at the bottom and supports Update and JSON import. Records absent from an update are retained; historical calls/bonuses keep their saved identity and artwork. Catalogue changes do not modify Roulobets.

Refresh is a manual admin action, not scheduled. Rainbet may block server requests with Cloudflare; the button reports failure and retains the existing list. JSON import is the fallback. No access challenge is bypassed. Accepted formats are normalized records or Rainbet `{games:[...]}` slot records. No links are guessed from display names.

## Production deployment

Migration `20261008032402_community_hunts_production.sql` was applied to Trashguy project `xugobohuvltolrovudtm` and recorded in its migration history before the release. No new environment variables are needed: existing Supabase URL and server secret are used. Never commit or share `.env.local`.

Production always uses Supabase, even if the old local-test variables are present. Public/admin navigation is enabled without a build-time test flag. `community_documents` holds hunt and catalogue snapshots; `community_requests` holds server-only command receipts. The commit RPC uses a row lock and version comparison, so concurrent Vercel instances retry against fresh state rather than overwrite each other. The successful command receipt is written atomically with its state; a retry with the same request ID cannot create a second record. Authenticated server handlers enforce participant/admin rules; the tables and commit RPC deny direct anonymous/viewer access and enable RLS. The snapshot has a 20 MB limit; this is intended for a single streamer community, not a high-volume multi-tenant system.

After pushing main, verify `/api/community` returns `localTest:false`, then open the public menu and Admin > Community Hunt. Start a fresh hunt; local test data is deliberately not imported. The standard OBS URL continues working.

## Isolated local tests

`COMMUNITY_HUNT_LOCAL=1` only takes effect when NODE_ENV is not production. In local development it uses ignored `.local/community-hunts.json` and `.local/rainbet-catalogue.json`, preserving existing test hunts without touching live community state. The old NEXT_PUBLIC_COMMUNITY_HUNT_LOCAL switch is no longer needed. A production-mode local server uses the real database.

Run `npm run test:community`, `npm run test:community:production` and `npm run test:tracker`. The first uses a disposable temp directory; the second simulates four independent production instances with conflicting writes and replayed commands. Both avoid real database mutations. The production database RPC was additionally checked in a transaction that was rolled back, including stale-write and replay protection and direct-role permission checks.
