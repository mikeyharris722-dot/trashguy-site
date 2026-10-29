# Discord slot picker lists

Admin Settings → Discord slot calls controls the private webhook, enable switch, status and manual refresh.

Three persistent list groups show waiting/playing calls, successful calls and failed calls. Results follow site_tracker_settings.active_hunt_id. Manual bonuses and community hunts are excluded. Large lists use additional messages; their IDs persist and are edited, not reposted. Surplus pages are removed using this webhook only.

Configuration is in the service-only RLS-protected discord_slot_board table. Never place the webhook in client code, prize settings, source control or public JSON. Apply migration 20261029200339 before publishing. Configuration and initial message IDs have already been saved for the supplied channel.

Successful regular call/tracker mutations schedule a batched background refresh. Existing slot-call reads also reconcile at most every 30 seconds per warm instance, covering transient failures while the site is active. Discord failures do not fail the slot call. Durable lease prevents concurrent writers; Discord retry_after is respected. Deleted board messages are recreated on the next changed update. Unchanged message bodies skip Discord API requests. Local preview never posts.

Checks: node scripts/discord-slot-board-tests.cjs; node scripts/hunt-isolation-tests.cjs; node scripts/discord-slot-board-sql-tests.cjs <disposable-container>; npm run build.
