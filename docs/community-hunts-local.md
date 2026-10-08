# Community Hunt — local test branch

Branch: `feature/community-hunts`. Nothing has been pushed or deployed.

## Local setup already configured on Chris’s machine

Run `npm run dev -- --hostname 127.0.0.1 --port 3200`, then open http://localhost:3200/.
The ignored local environment file contains `COMMUNITY_HUNT_LOCAL=1` and `NEXT_PUBLIC_COMMUNITY_HUNT_LOCAL=1` alongside existing authentication settings. Never commit this file.

## Test workflow

1. Sign in with Twitch. Admin users open Admin > Community Hunt and create a clearly labelled TEST hunt. Choose call spaces per player. Bankroll starts at zero.
2. Open Community Hunt from the public three-line menu. Enter your own contribution and request to join.
3. Return to Admin > Community Hunt and approve the registration. Only approved contributions count towards the bankroll.
4. Return to the public room and submit a Rainbet catalogue call. Admins may also add host calls.
5. Admins select Random call, open the artwork/name on Rainbet, and record Passed with bet size or Failed. Game navigation never records a result or places a bet.
6. Passed bonuses appear in the same tracker component used by ordinary hunts. Edit bets, tiers and notes, reorder, remove, or undo results during collection. Duplicate slots are rejected.
7. Start opening. The existing payout dialog advances in saved order; Skip moves a pending bonus to the end. Contributions and calls are frozen while opening.
8. The local OBS URL is http://localhost:3200/overlay?community=1, at 435 × 285. The selected community hunt supplies its totals and opening order. Ordinary `/overlay` is unchanged.

## Catalogue

Initial snapshot contains 4,088 active catalogue records with stored Rainbet links copied read-only from the original Slot Hub project. IDs and canonical links are preserved; no display-name URL guessing.

Admin > Community Hunt > Rainbet catalogue has Update Rainbet catalogue and JSON import. The refresh uses the public endpoint from the original import implementation and follows pages to completion before saving. It validates all records and allowed HTTPS Rainbet slot links. Import accepts a normalized array (identifier, name, provider, artwork_url, rainbet_launch_url) or raw Rainbet `{games:[...]}` records (id, name, producer, type, url, custom_banner/icon). A source-provided slug is allowed for a raw `type:slots` record; arbitrary redirect/executable URLs are rejected.

Existing records absent from a refresh are retained. Calls/bonus snapshots are not rewritten by catalogue updates. Local catalogue files have a recoverable prior copy. Automatic fetch from this environment returned a Cloudflare block: this is reported in the UI without replacing the catalogue. No access challenge is bypassed. JSON import is the fallback; direct server refresh has not been demonstrated successful.

## Storage and privacy

This is a local functional prototype. Community hunts and catalogue updates persist in ignored `.local/` JSON files on this machine. Writes are serialized, and hunt deletion is a recoverable hidden flag. Supabase is used only to validate existing sign-in/admin access. No new production tables, live hunt selections, contributions, payouts or settlements are written.

Public readers see approved player display names, calls, tracker totals and results. Pending registrations, individual contribution amounts (apart from the signed-in user’s own amount), and private tracker notes are withheld. Admin commands validate the existing protected admin profile. A client-side admin flag does not grant API access.

## Before publishing

Do not deploy this file-backed prototype as a production community service. A durable Supabase schema, transactions, idempotent commands, RLS/permissions, audit trail and multi-user deployment verification must replace `.local/` storage first. Review the local workflow before that migration. No payment collection or settlement transfers are implemented. This first prototype is the website workflow; the original Slot Hub sidebar extension has not been ported to this domain.

## Verification

`npm run test:community`: isolated temporary data, admin authorization at the command boundary, registration approval and equity totals, call limits and space release, duplicate protection, random selection, Passed/Failed, phase freeze, payout calculations, validated Rainbet destinations, catalogue import, recoverable deletion.
`npm run test:tracker`: existing tracker checks.
TypeScript, focused ESLint and production build passed before final UI polish. The live Rainbet refresh was blocked as described above. Real-money gameplay and cross-network/OBS application testing are outside this local demonstration.
