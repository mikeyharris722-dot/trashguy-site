# Independent giveaway luck

ALL uses the existing giveaway_luck.luck/loss_count/win_count columns. VIP uses vip_luck/vip_loss_count/vip_win_count in the same protected table. The existing viewer/on-code/Discord/VIP base bonuses and eligibility rules are unchanged. The separate VIP saved luck is never used by ALL.

Apply migration 20261107023952_split_giveaway_luck.sql before publishing the application changes. It copies every existing balance and counter exactly into the VIP columns without resetting ALL, changing entries or drawing prizes. Existing row permissions and RLS remain unchanged. Do not re-run the backfill after the split: it would merge distinct balances.

The legacy bridge mirrors old-version writes only while luck_modes_split is false. The first mode-aware draw update marks that account split; future ALL/VIP changes affect their own columns only. New accounts initialize both balances at zero, with conflict-safe insert-only bootstrap so simultaneous mode draws cannot overwrite an existing account. After release, old clients must refresh before drawing. Normal cached profile/read polling is safe.

Each draw uses only eligible entries for that giveaway. Existing winners of that giveaway are excluded, the selected winner resets only that mode’s luck, and each unique entered non-winner receives +1 only in that mode. Non-entrants do not change. Subsequent winners may be drawn from the same giveaway as before. Profile odds label ALL explicitly and display VIP luck/total separately for VIPs.

Verification: node scripts/giveaway-mode-tests.cjs; node scripts/giveaway-luck-tests.cjs; node scripts/profile-wager-tests.cjs; npx tsc --noEmit; production build. Database migration/bridge tests use isolated PostgreSQL via PGlite: install test-only with npm install --prefix .local/luck-db-test --no-package-lock --no-save @electric-sql/pglite, then node scripts/giveaway-luck-db-tests.cjs. No production dependency is added. No real giveaway is drawn during tests.

Release checks: back up giveaway_luck before applying the migration; verify existing ALL and copied VIP values/counters match; publish the tested code; verify GET /api/chat-giveaway?type=regular and type=vip use their respective balances. Do not run a production draw solely for testing. Live migration/release has not been performed as part of local implementation.
