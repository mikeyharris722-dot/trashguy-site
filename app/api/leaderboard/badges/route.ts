import { leaderboardResults } from "@/lib/leaderboard-provider";
import { withLeaderboardBadges } from "@/lib/leaderboard-badges";
export async function GET(request: Request) {
  try {
    const result = await leaderboardResults(new URL(request.url).searchParams.get("period"));
    const players = await withLeaderboardBadges(result.players.slice(0, 10));
    return Response.json({players:players.map(player=>({username:player.username,badges:player.badges || []}))}, {headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"Badges are temporarily unavailable."},{status:503}); }
}
