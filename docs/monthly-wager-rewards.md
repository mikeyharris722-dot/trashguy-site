# Monthly wager rewards

Monthly rewards use the configured leaderboard start and exclusive end dates. Internally, the existing weeklyWager settings key, claim history table and legacy URL remain compatible. The new periodMode=leaderboard marker distinguishes monthly settings from the previous independent weekly configuration. Legacy weekly settings resolve to a disabled monthly preview with the seven approved default milestones. Existing claims and rewards are retained.

Apply migration 20261103181902_monthly_wager_rewards.sql before enabling the feature. It adds a service-role-only claim_monthly_wager RPC with transactional reward creation, saved-settings checks, exclusive deadline enforcement and per-user/period/milestone uniqueness. It leaves the old RPC intact for a safe code rollout. The activation check rejects a missing new RPC. No payment is sent automatically: claims are added to the existing Prize Portal fulfilment flow.

In Admin > Prize Settings, review Monthly Wager Rewards, configure up to ten increasing milestones and save/activate. Payouts are incremental and stack. Defaults: 5K=$10, 10K=$15, 15K=$20, 25K=$30, 50K=$40, 75K=$50, 100K=$60 ($225 cumulative). Changing a saved payout never changes an already claimed reward. Keep milestone IDs stable within a period: removing and recreating one creates a new milestone. Leaderboard rollover automatically changes the claim period; extending the end date does not reset claims.

VIP eligibility is 10,000 weighted wager in the current leaderboard or a qualifying saved previous-leaderboard snapshot. Snapshot reads check saved wager amounts, rather than treating old 5K membership as sufficient. Current giveaway/background sync reads follow the configured leaderboard period; background sync uses weighted wager. Provider-unavailable profile behavior retains existing saved status until a successful refresh, as before. This does not implement Twitch VIP role synchronization.

Checks: weekly-wager-tests.cjs, monthly-rewards-db-tests.cjs (isolated named Docker Postgres), vip-threshold-tests.cjs, provider-read-tests.cjs, trash-claw-settings-api-tests.cjs, site-review-tests.cjs, tracker-tests.cjs, community-tests.cjs, community-stats-tests.cjs, TypeScript, scoped ESLint and production build.

Launch restriction: only leaderboard periods starting on or after 5 November 2026 qualify. The UI, server and database independently block the current October–November period even if enabled. The date gate uses UTC and is not admin-editable.

VIP transition correction (5 November): preserve the 5,000 weighted wager requirement for VIP earned in periods ending on or before 5 November 2026. The current leaderboard and subsequent completed periods require 10,000. Previous eligibility checks use the period-specific requirement; the snapshot generator uses the same rule and upserts without deleting historical eligibility records.
