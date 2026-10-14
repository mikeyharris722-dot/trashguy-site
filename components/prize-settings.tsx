"use client";
import {defaultBossTargets} from "@/lib/trash-bosses";

import ObsSettings from "./obs-settings";
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
      if ([...amounts, prediction,...bosses.flatMap(b=>[b.target,b.reward])].some((value) => !value.trim()))
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
        "Prize settings saved. The public leaderboard has updated. New community hunts will use this prediction prize.",
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
          <p className="eyebrow">Public prize amounts</p>
          <h2>Prizes & payouts</h2>
          <p>
            Set the amounts visitors see. Existing rewards, claims and community
            hunt prizes keep their recorded values.
          </p>
        </div>
        <div className="prize-pool">
          <span>Leaderboard prize pool</span>
          <strong>{dollars(prizeTotal(preview))}</strong>
        </div>
      </div>
      <ObsSettings />
      <LeaderboardTotals settings={settings} />
      <form onSubmit={submit}>
        <fieldset disabled={busy}><legend>RTP contribution guide</legend><p>Display only. Roulo’s weighted wager determines the standings.</p><label>Weighting rules<textarea rows={3} value={weighting} maxLength={2000} onChange={e=>setWeighting(e.target.value)} /></label></fieldset>
        {pastPeriods.length>0&&<fieldset disabled={busy}><legend>Completed leaderboard prizes</legend><p>Confirm actual prizes won for previous periods. Changing current prizes will not change a saved historical prize schedule.</p><label>Completed period<select aria-label="Historical prize period" value={archivePeriod} onChange={e=>{setArchivePeriod(e.target.value);setArchivePrizes((archives.find(p=>p.start===e.target.value)?.prizes||Array(10).fill('')).map(String));setArchiveMessage('');}}>{pastPeriods.map(p=><option key={p.start} value={p.start}>{periodLabel(p)}</option>)}</select></label><div className="prize-fields">{archivePrizes.map((amount,index)=><label key={index}>Place {index+1}<input type="number" min="0" max="1000000" step="0.01" value={amount} placeholder="Unconfirmed" onChange={e=>setArchivePrizes(old=>old.map((p,i)=>i===index?e.target.value:p))}/></label>)}</div><button type="button" onClick={()=>{try{if(archivePrizes.some(v=>!v.trim()))throw Error('Enter every historical prize. Use 0 for no prize.');const period=pastPeriods.find(p=>p.start===archivePeriod)!;const next=[...archives.filter(p=>p.start!==period.start),{start:period.start,end:period.end,prizes:archivePrizes.map(Number)}];validatePrizeSettings({...preview,leaderboardArchives:next});setArchives(next);setArchiveMessage('Historical prizes ready. Save settings below to confirm.');}catch(error){setArchiveMessage(error instanceof Error?error.message:'Check prize amounts.');}}}>Confirm historical prizes</button>{archiveMessage&&<p role="status">{archiveMessage}</p>}</fieldset>}
        <fieldset disabled={busy} className="competition-settings">
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
        </fieldset>
        <fieldset disabled={busy}>
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
        </fieldset>
        <fieldset disabled={busy}><legend>Trash Bosses</legend><label className="boss-activation"><input type="checkbox" checked={bossEnabled} onChange={e=>setBossEnabled(e.target.checked)}/> Activate Trash Bosses for viewers</label><small>{bossEnabled?"Public page and reward claims enabled after saving.":"Hidden from non-admins. Admins can preview and configure values. Claims are disabled."}</small><p>Targets use total viewer slot-call winnings in the leaderboard period above. Rewards are display amounts; saving does not issue a payment.</p><div className="prize-fields boss-prize-fields">{bosses.map((boss,index)=><div key={index}><label>Boss {index+1} target ($)<input required type="number" min="0.01" max="1000000" step="0.01" value={boss.target} onChange={e=>setBosses(old=>old.map((b,i)=>i===index?{...b,target:e.target.value}:b))}/></label><label>Boss {index+1} reward ($)<input required type="number" min="0" max="1000000" step="0.01" value={boss.reward} onChange={e=>setBosses(old=>old.map((b,i)=>i===index?{...b,reward:e.target.value}:b))}/></label></div>)}</div></fieldset>
        <label className="prediction-prize-field">
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
        <div className="form-footer">
          <p>
            Leaderboard total is calculated automatically. Saving these settings
            does not issue a payment.
          </p>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Save prize amounts"}
          </button>
        </div>
        {message && (
          <p className="form-feedback" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
