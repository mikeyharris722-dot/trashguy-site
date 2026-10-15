import "server-only";
import { siteDb } from "./site-db";
import { localCommunity } from "./community-store";
import { communityState } from "./community-local";
import { resolvedPrizeSettings, type PrizeSettings } from "./prize-settings";
/** Read just settings, not every community hunt, member, entry and prediction. */
export async function serverPrizeSettings() {
  if (localCommunity()) return resolvedPrizeSettings((await communityState()).prizeSettings);
  const {data,error} = await siteDb().from("community_documents").select("settings:payload->prizeSettings").eq("id","hunts").single();
  if (error) throw Error("Saved prize settings are temporarily unavailable.");
  return resolvedPrizeSettings(data.settings as PrizeSettings | undefined);
}
