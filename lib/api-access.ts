export function requiresAdmin(path: string, method: string) {
  return (
    path.startsWith("/api/admin/") ||
    (path === "/api/prize-settings" && !["GET", "HEAD"].includes(method)) ||
    (["/api/chat-giveaway", "/api/chat-giveaway/draw", "/api/chat-giveaway/delete"].includes(path) && !["GET", "HEAD"].includes(method)) ||
    path === "/api/rewards" ||
    (path === "/api/monthly-rewards" && !["GET", "HEAD"].includes(method))
  );
}
