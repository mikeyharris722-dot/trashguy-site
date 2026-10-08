export function requiresAdmin(path: string, method: string) {
  return (
    path.startsWith("/api/admin/") ||
    path === "/api/rewards" ||
    (path === "/api/monthly-rewards" && !["GET", "HEAD"].includes(method))
  );
}
