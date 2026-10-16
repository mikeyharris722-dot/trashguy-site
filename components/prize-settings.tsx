"use client";
import {defaultWeeklyWager} from "@/lib/weekly-wager";
import {defaultBossTargets} from "@/lib/trash-bosses";

import TwitchPointsSettings from "./twitch-points-settings";
import ObsSettings, {ClawObsSettings} from "./obs-settings";
import LeaderboardTotals from "./leaderboard-totals";
import {leaderboardPeriods} from "@/lib/leaderboard-data";
import {periodLabel} from "./leaderboard";
import { useState } from "react";
import { siteFetch } from "@/lib/site-fetch";
import {
  prizeTotal,
  validatePrizeSettings,
  type PrizeSettings,
} from "@/lib/prize-settings";
const dollars = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export default function PrizeSettingsEditor({
  settings,
  saved,
}: {
  settings: PrizeSettings;
  saved: (settings: PrizeSettings) => void;
}) {
  const [amounts, setAmounts] = useState(settings.leaderboard.map(String));
  const [prediction, setPrediction] = useState(
    String(settings.predictionPrize),
  );
  const [weekly,setWeekly]=useState(settings.weeklyWager||defaultWeeklyWager);
  const [weeklyAmounts,setWeeklyAmounts]=useState((settings.weeklyWager||defaultWeeklyWager).targets.map(t=>({id:t.id,target:String(t.target),reward:String(t.reward)})));
  const [bossEnabled,setBossEnabled]=useState(settings.trashBossesEnabled===true);
  const [bosses,setBosses]=useState((settings.trashBosses||defaultBossTargets).map(b=>({target:String(b.target),reward:String(b.reward)})));
  const [weighting,setWeighting]=useState(settings.leaderboardWeighting||'');
  const [archives,setArchives]=useState(settings.leaderboardArchives||[]);
  const pastPeriods=leaderboardPeriods(settings,Date.parse(settings.leaderboardStart+'T00:00:00Z')).filter(p=>p.start!==settings.leaderboardStart&&p.end<=settings.leaderboardStart);
  const [archivePeriod,setArchivePeriod]=useState(pastPeriods[0]?.start||'');
  const [archivePrizes,setArchivePrizes]=useState((archives.find(p=>p.start===archivePeriod)?.prizes||Array(10).fill('')).map(String));
  const [archiveMessage,setArchiveMessage]=useState('');
  const [start, setStart] = useState(settings.leaderboardStart);
  const [end, setEnd] = useState(settings.leaderboardEnd);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const preview = {
    weeklyWager:{...weekly,targets:weeklyAmounts.map(t=>({id:t.id,target:Number(t.target),reward:Number(t.reward)}))},
    leaderboard: amounts.map(Number),
    leaderboardWeighting:weighting,
    leaderboardArchives:archives,
    trashBossesEnabled:bossEnabled,
    trashBosses:bosses.map(b=>({target:Number(b.target),reward:Number(b.reward)})),
    predictionPrize: Number(prediction),
    leaderboardStart: start,
    leaderboardEnd: end,
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      if ([...amounts, prediction,...weeklyAmounts.flatMap(t=>[t.target,t.reward]),...bosses.flatMap(b=>[b.target,b.reward])].some((value) => !value.trim()))
        throw Error("Fill every prize amount. Use 0 for places with no prize.");
      const next = validatePrizeSettings(preview);
      setBusy(true);
      const response = await siteFetch("/api/prize-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: next,
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Could not save prize settings.");
      saved(data.settings);
      setMessage(
        "Settings saved. Public pages now use the updated values.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-panel prize-editor">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Admin settings</p>
          <h2>Rewards & settings</h2>
          <p>
            Open a section to edit its settings, then save your changes below.
          </p>
        </div>
        <div className="prize-pool">
          <span>Leaderboard prize pool</span>
          <strong>{dollars(prizeTotal(preview))}</strong>
        </div>
      </div>

      <form onSubmit={submit} onInvalidCapture={event=>{let parent=(event.target as HTMLElement).parentElement;while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}}}>
<div className="settings-sections"><details className="settings-section"><summary><span><strong>Monthly leaderboard</strong><small>Competition dates, place prizes and RTP guide</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body"><fieldset disabled={busy} className="competition-settings">
          <legend>Site leaderboard schedule</legend>
          <p>
            Choose Trashguy’s own competition period. The dates control both the
            standings requested from Roulo and this site’s countdown; they do
            not change Roulo’s competition.
          </p>
          <div className="prize-fields">
            <label>
              Start date (UTC)
              <input
                type="date"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              End date (UTC)
              <input
                type="date"
                required
                min={start || undefined}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
          </div>
          <small>The period starts and ends at 00:00 UTC on these dates.</small>
        </fieldset><fieldset disabled={busy}>
          <legend>Leaderboard places</legend>
          <div className="prize-fields">
            {amounts.map((amount, index) => (
              <label key={index}>
                Place {index + 1}
                <div className="money-field">
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) =>
                      setAmounts((old) =>
                        old.map((value, place) =>
                          place === index ? event.target.value : value,
                        ),
                      )
                    }
                  />
                </div>
              </label>
            ))}
          </div>
        </fieldset><fieldset disabled={busy}><legend>RTP contribution guide</legend><p>Display only. Roulo’s weighted wager determines the standings.</p><label>Weighting rules<textarea rows={3} value={weighting} maxLength={2000} onChange={e=>setWeighting(e.target.value)} /></label></fieldset></div></details><details className="settings-section"><summary><span><strong>Previous leaderboard prizes</strong><small>Review the prize amounts for a completed month</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body">{pastPeriods.length>0&&<fieldset disabled={busy}><legend>Completed leaderboard prizes</legend><p>Confirm actual prizes won for previous periods. Changing current prizes will not change a saved historical prize schedule.</p><label>Completed period<select aria-label="Historical prize period" value={archivePeriod} onChange={e=>{setArchivePeriod(e.target.value);setArchivePrizes((archives.find(p=>p.start===e.target.value)?.prizes||Array(10).fill('')).map(String));setArchiveMessage('');}}>{pastPeriods.map(p=><option key={p.start} value={p.start}>{periodLabel(p)}</option>)}</select></label><div className="prize-fields">{archivePrizes.map((amount,index)=><label key={index}>Place {index+1}<input type="number" min="0" max="1000000" step="0.01" value={amount} placeholder="Unconfirmed" onChange={e=>setArchivePrizes(old=>old.map((p,i)=>i===index?e.target.value:p))}/></label>)}</div><button type="button" onClick={()=>{try{if(archivePrizes.some(v=>!v.trim()))throw Error('Enter every historical prize. Use 0 for no prize.');const period=pastPeriods.find(p=>p.start===archivePeriod)!;const next=[...archives.filter(p=>p.start!==period.start),{start:period.start,end:period.end,prizes:archivePrizes.map(Number)}];validatePrizeSettings({...preview,leaderboardArchives:next});setArchives(next);setArchiveMessage('Historical prizes ready. Save settings below to confirm.');}catch(error){setArchiveMessage(error instanceof Error?error.message:'Check prize amounts.');}}}>Confirm historical prizes</button>{archiveMessage&&<p role="status">{archiveMessage}</p>}</fieldset>}</div></details><details className="settings-section"><summary><span><strong>Weekly wager rewards</strong><small>Visibility, weekly dates, target and payout</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body"><fieldset disabled={busy}><legend>Weekly Trash Cashback</legend><label className="boss-activation"><input type="checkbox" checked={weekly.enabled} onChange={e=>setWeekly({...weekly,enabled:e.target.checked})}/> Activate weekly wager rewards for viewers</label><small>{weekly.enabled?'Page, menu and claims become available after saving.':'Hidden from regular viewers. Admin preview remains available; claims are disabled.'}</small><div className="weekly-admin-fields"><label>Start date (UTC)<input required type="date" value={weekly.start} onChange={e=>setWeekly({...weekly,start:e.target.value})}/></label><label>End date (inclusive, UTC)<input required type="date" value={weekly.end} onChange={e=>setWeekly({...weekly,end:e.target.value})}/></label>{weeklyAmounts.map((t,i)=><div key={t.id} className="weekly-admin-fields" style={{gridColumn:'1/-1'}}><label>Weighted wager target ($)<input required type="number" min="0.01" max="1000000" step="0.01" value={t.target} onChange={e=>setWeeklyAmounts(old=>old.map((t,n)=>n===i?{...t,target:e.target.value}:t))}/></label><label>Reward payout ($)<input required type="number" min="0.01" max="1000000" step="0.01" value={t.reward} onChange={e=>setWeeklyAmounts(old=>old.map((t,n)=>n===i?{...t,reward:e.target.value}:t))}/></label></div>)}</div><p>The end date includes the whole day, up to 23:59:59 UTC, for everyone. Dates are independent of the monthly leaderboard. Every qualifying viewer can claim once per target and start date. Extending an end date does not reset claims. Set the next period’s dates to start a new week.</p></fieldset></div></details><details className="settings-section"><summary><span><strong>Slot call rewards</strong><small>Visibility, boss targets and payouts</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body"><fieldset disabled={busy}><legend>Boss targets</legend><label className="boss-activation"><input type="checkbox" checked={bossEnabled} onChange={e=>setBossEnabled(e.target.checked)}/> Activate slot call rewards for viewers</label><small>{bossEnabled?"Public page and reward claims enabled after saving.":"Hidden from non-admins. Admins can preview and configure values. Claims are disabled."}</small><p>Targets use total viewer slot-call winnings in the leaderboard period above. Rewards are display amounts; saving does not issue a payment.</p><div className="prize-fields boss-prize-fields">{bosses.map((boss,index)=><div key={index}><label>Boss {index+1} target ($)<input required type="number" min="0.01" max="1000000" step="0.01" value={boss.target} onChange={e=>setBosses(old=>old.map((b,i)=>i===index?{...b,target:e.target.value}:b))}/></label><label>Boss {index+1} reward ($)<input required type="number" min="0" max="1000000" step="0.01" value={boss.reward} onChange={e=>setBosses(old=>old.map((b,i)=>i===index?{...b,reward:e.target.value}:b))}/></label></div>)}</div></fieldset></div></details><details className="settings-section"><summary><span><strong>Bonus hunt predictions</strong><small>Prize for the closest prediction</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body">        <label className="prediction-prize-field">
          Closest prediction prize ($)
          <input
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            required
            disabled={busy}
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
          />
          <small>
            Used for the bonus hunt prediction banner and saved onto newly
            created community hunts. Set 0 to show no cash prize.
          </small>
        </label>
</div></details></div>
        <div className="form-footer">
          <p>
            Leaderboard total is calculated automatically. Saving these settings
            does not issue a payment.
          </p>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
        {message && (
          <p className="form-feedback" role="status">
            {message}
          </p>
        )}
      </form>
      <div className="settings-tools"><ObsSettings /><ClawObsSettings /><TwitchPointsSettings /><details className="settings-section"><summary><span><strong>Affiliate totals</strong><small>Monthly totals for every player on the code</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body"><LeaderboardTotals settings={settings} /></div></details></div>
    </section>
  );
}
