# Trashguy — local review and morning test checklist

Prepared on 8 October 2026. **These changes are local and have not been pushed or deployed.**

Open **http://localhost:3200/#home**. The gold “Local review · Not published” banner confirms you are using the review environment.

Branch: `review/site-usability-local`.

## What changed

### Across the site

- Rebuilt the navigation menu with readable names, short descriptions, an active-page indicator and a visible sign-out option.
- Added a named menu control, keyboard focus outlines, a working Skip to content link, Escape-to-close and outside-click closing.
- Added section links in the URL. Refresh, browser Back and Forward now retain the correct section; invalid section names return Home.
- Preserved section links through the existing Kick sign-in cleanup.
- Improved text contrast, small labels, form sizing and touch controls while retaining the purple, spooky Trashguy artwork.
- Added page introductions and optional “How to use this page” instructions for the public sections.
- Replaced blocking browser alerts with dismissible messages that also remain visible above entry dialogs.
- Added a slow ambient glow and support for reduced-motion preferences.

### Home and public pages

- Added clear home-page routes to Community Hunt, viewer calls and your profile/rewards.
- Show recent winners in batches of 20, with a button to load more, rather than rendering the entire history immediately.
- Replaced the huge bonus-hunt history strip with eight recent hunts and a full-history selector.
- Fixed a significant behaviour issue: viewing a hunt as an admin no longer automatically opens its predictions or closes another hunt. Those actions now have explicit buttons.
- Added a searchable RouloBets catalogue to the slot picker. Selecting a game displays its name/provider and a copyable `!slot` command. It does not post anything to Twitch.
- Improved slot search with loading/error states, clear/reset, keyboard arrows and Enter, and explicit selected-game feedback.
- Added accessible names to previously unnamed profile, prize, tournament and draft fields.

### Community Hunt

- Added optional start date/time and time-zone fields when creating a hunt.
- Added a public schedule card showing the date, clock time and time zone before registration.
- Default time zone is Europe/London. Also supports UTC, Paris, New York, Los Angeles and Sydney.
- Correctly converts summer/winter offsets. Invalid dates, past new schedules and missing/repeated daylight-saving clock times produce a useful error.
- Added editable hunt name, schedule and call limit. Existing unscheduled hunts continue to work and display “Start time to be announced”.
- Put public registration directly beneath the schedule, before the statistics and longer explanations.
- Added clearer joining steps, pending/approved states, available call spaces, queue labels and empty states.
- Players can correct or withdraw a pending contribution request before approval. Approved contributions remain protected from participant edits.
- Added typo-aware Rainbet search, including `ntu job` → Nut Job as a suggestion requiring selection. Exact/contained words take precedence over fuzzy suggestions, so `Wanted Dead` does not put an unrelated sequel first.
- Paused hidden-page refreshes and retained community form drafts when switching sections/workspaces. A change of signed-in account resets those drafts.

### Admin, tracker and access checks

- Reworked the eight admin workspace buttons into a more readable layout and added an explanation for each workspace.
- Paused the hidden giveaway panel’s refresh effects while retaining its form state.
- Added readable tracker phases, summary cards and an explanation of the required average.
- Fixed reordering when a hunt contains failed calls: only collected bonuses belong in the bonus order.
- Disabled unavailable Up/Down actions and clear the drag state after a cancelled/completed drag.
- Added clear tracker loading/error handling and empty bonus-list feedback.
- Batched paid-prize history and changed the unclear “Undo” label to “Mark unpaid”.
- Added server-side checks to the older admin/reward routes. Admin access is tied to the verified account ID and protected profile flag, rather than a display name.
- Protected reward viewing/claims using the verified Twitch identity or signed Kick session. A caller-provided viewer name cannot choose another person’s rewards.
- Added private/no-store headers to private API responses.
- Automatically attach the current session to this site’s API requests; never attach it to external URLs.
- Logout now targets the current session rather than signing out every other session.

## What is safe to test here

**Community Hunt changes save to local files. Existing ordinary hunts can be selected and viewed using a local selection file. Other actions that would save to the live database are deliberately blocked.**

The preview uses existing site data and your login for reads. No live hunt, reward, contribution, catalogue, admin role or database schema was changed as part of this review. No Twitch or Discord messages were sent.

The write protection applies both to incoming API requests and the Supabase clients, including legacy pages that perform an update while loading. Do not remove the local review flags while testing against the current environment file.

## Local demonstration hunt

Select **LOCAL REVIEW · Friday Community Hunt**.

| Item | Initial demo value |
| --- | --- |
| Date/time | Friday 9 October 2026, 20:00 BST |
| Time zone | Europe/London |
| Approved bankroll | $100 from DEMO Approved Player |
| Your request | Gettyyy_ — $25, awaiting approval |
| Other pending request | DEMO Pending Player — $50 |
| Bonus 1 | Wanted Dead or a Wild — $1, Super, with a demo note |
| Bonus 2 | Gates of Olympus — $0.50, Standard |
| Bonus 3 | Snoop Dogg Dollars — $2, Super Super, with a demo note |
| Calls waiting | Nut Job and Chicken Man |
| Failed-call example | Sweet Bonanza |

These are fictional local test records. Your earlier **TEST-0002** and **TEST Community Hunt 001** records were preserved. A local backup was taken before adding demo participants and bonuses. The demo seed command retains an existing demo instead of resetting your subsequent edits.

## Suggested morning test order

1. **Home:** read the welcome cards, open each destination, and load another batch of winners.
2. **Menu:** press Tab to reach it, open it, use Escape to close it, then try clicking outside it. Check the active-page indication.
3. **Navigation:** switch between two sections, use Back/Forward, and refresh. The section should stay correct. Try Skip to content.
4. **Public Community Hunt:** confirm the Friday start time is visible above your registration. Check the joining instructions and approved-player list.
5. **Pending request:** open “Change my request”, change $25 to $30, save, then restore $25 if you want the initial demo amounts. You can also withdraw and request to join again.
6. **Admin Community Hunt:** confirm the pending amount follows your public edit. Approve your request; the bankroll should increase by the approved amount. Approve/decline the other demo request as desired.
7. **Schedule:** edit the existing demo’s date/time, name or call limit. Return to the public page and check the update. Clear the date to test the to-be-announced state.
8. **Create a hunt:** expand “Create a community hunt”, choose a name, future date, time zone and call limit. Check its public schedule. Also try a past date and then a blank optional date.
9. **Call search:** type `ntu job`, use arrows/Enter or click to select Nut Job. The demo already has that call, so adding it again should be rejected. Choose another game to test a new call.
10. **Collected-slot duplicate:** try adding Wanted Dead or a Wild again in the manual tracker. It should report that the slot is already in the hunt.
11. **Queue:** use Random call on a demo call, then record Got bonus with a bet size or No bonus. The call should leave the waiting queue and appear in the correct result tab.
12. **Tracker order:** move Snoop Dogg Dollars to the top with arrows or dragging. Confirm the order survives refresh, even though the demo also contains a failed call. Boundary arrows should be disabled.
13. **Bonus details:** edit a bet, tier and note on a local demo bonus; save. Super/Super Super labels and notes should remain easy to distinguish.
14. **Opening:** press Start opening. The first popup should follow your saved order. Skip a bonus, enter another payout and confirm; the skipped bonus should return at the end. Use zero as a valid payout example.
15. **Public during opening:** new registrations/calls should be closed. Statistics should reflect the local recorded results.
16. **OBS:** open http://localhost:3200/overlay using 435 × 285. Check collection scrolling and the static opening order/latest-result view. Refresh while opening to verify the queue is retained.
17. **Existing hunt:** use the main Bonus Hunt Tracker selector to view the existing ordinary hunt. That selection is local; saving a bet/result on an ordinary live record should be blocked with a clear review message. Select the local community hunt again to continue save tests.
18. **Prediction history:** choose an older hunt. It should display without opening predictions. Explicit prediction-management buttons remain blocked from saving to live data in this preview.
19. **Slot picker:** check the featured providers, View more, manual search and copied Twitch command. Random picking remains separate from submitting a chat call.
20. **Profile:** check account/reward readability and messages. Actual links, claims and payments are not part of these local save tests.
21. **Admin workspaces:** visit Giveaways, Trash Claw, Prize Portal, Tournaments and Snake Drafts. Check the explanations, field labels and layout. Live-saving buttons should return the review message; do not expect a real prize or payment to be recorded.
22. **Small screen:** narrow the browser to phone width. Check the header, menu, schedule, forms and tracker; the page should not scroll sideways. The tournament bracket may scroll inside its own panel.

## Checks completed

- TypeScript check passed.
- Production build passed.
- Focused ESLint checks on the new/reworked components, helpers and tracker/overlay routes passed.
- Existing tracker, community and production-concurrency regression suites passed.
- New local-review tests passed for scheduling/DST, invalid/past dates, contribution correction/cancellation, approved-equity protection, mixed failed/collected reordering, closed-call protection, typo search, admin identity checks, local write isolation, local native selection and API-token destination restrictions.
- Anonymous reward/profile requests returned 403. An attempted ordinary live-data mutation returned the local-review rejection.
- The public sections and all eight admin workspaces were inspected in the local browser.
- Phone-width checks at 390 px found no page-level horizontal overflow in the public sections. Home and the public schedule were visually checked on desktop/phone layouts.
- Browser Back/Forward was checked against the displayed section headings.
- The scheduled demo was created through the local admin form and read back with the correct UTC/London conversion. Pending contribution changes were also saved through the browser, verified locally, then restored to the documented $25 starting value.

## What still needs approval or separate testing

- Nothing has been published. Review the local changes before approving a release.
- Actual legacy admin saves, real reward claims/payments, account linking, live Twitch bot calls and OBS in the desktop OBS application were not exercised against production. Their integration checks need a development database or an explicitly approved release/test window.
- Existing Supabase policies were not changed in this local pass. The code access checks above are not a claim of a complete database security audit.
- Rainbet’s Update button can still be blocked by its source site. The existing JSON-import fallback remains; there is no new scheduled automatic refresh.
- The old PDF guide has not been rewritten for these staged changes; this checklist is the current review guide.

## If the preview is no longer running

Open the project folder in a terminal and run:

```powershell
cd C:\Users\chris\Documents\SlotHub\GitHub\trashguy-site
npm run dev -- --hostname 127.0.0.1 --port 3200
```

The ignored local environment already enables `COMMUNITY_HUNT_LOCAL=1` and `NEXT_PUBLIC_LOCAL_REVIEW=1`. Keep the existing secrets private and do not commit the environment file.

Repeatable checks: `npm run test:review`, `npm run test:community`, `npm run test:community:production`, and `npm run test:tracker`.

The demo can be prepared with `npm run review:demo`; it will not overwrite an existing demo you have already edited.
