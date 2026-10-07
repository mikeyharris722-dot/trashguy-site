export type CatalogueGame = {
  identifier: string;
  name: string;
  provider: string;
  producer?: string;
  artwork_url: string | null;
  enabled?: boolean;
  aliases?: string[];
};
export const normaliseSlot = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  let previousRow: number[] | null = null;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let k = 1; k <= b.length; k++) {
      next[k] = Math.min(
        next[k - 1] + 1,
        row[k] + 1,
        row[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1),
      );
      if (
        previousRow &&
        i > 1 &&
        k > 1 &&
        a[i - 1] === b[k - 2] &&
        a[i - 2] === b[k - 1]
      )
        next[k] = Math.min(next[k], previousRow[k - 2] + 1);
    }
    previousRow = row;
    row = next;
  }
  return row[b.length];
}
export function matchSlot(query: string, games: CatalogueGame[]) {
  const q = normaliseSlot(query);
  if (!q || q.length > 120)
    return { status: "review", suggestions: [] as CatalogueGame[], game: null };
  const providerAlias: Record<string, string> = {
    hacksawg: "hacksaw",
    hackawg: "hacksaw",
    nolimitcity: "nolimit",
    pragmaticexternal: "pragmatic",
    pragmaticplay: "pragmatic",
  };
  const logical = new Map<string, CatalogueGame>();
  for (const g of games.filter((g) => g.enabled !== false)) {
    const split = g.identifier.indexOf(":");
    const raw = split < 0 ? g.provider : g.identifier.slice(0, split);
    const provider = providerAlias[raw.toLowerCase()] || raw.toLowerCase();
    const id = split < 0 ? g.identifier : g.identifier.slice(split + 1);
    // Only equivalent provider aliases with the same source ID are grouped. Titles alone never merge sequels/variants.
    const key = provider + ":" + id.toLowerCase();
    const previous = logical.get(key);
    logical.set(
      key,
      previous
        ? {
            ...previous,
            aliases: [...(previous.aliases || []), ...(g.aliases || [])],
          }
        : g,
    );
  }
  const active = [...logical.values()];
  const exact = active.filter((g) =>
    [g.name, ...(g.aliases || [])].some((n) => normaliseSlot(n) === q),
  );
  if (exact.length === 1)
    return { status: "matched", game: exact[0], suggestions: exact };
  if (exact.length > 1)
    return { status: "review", game: null, suggestions: exact.slice(0, 6) };
  const scored = active
    .map((g) => ({
      g,
      score: Math.max(
        ...[g.name, ...(g.aliases || [])].map((n) => {
          const s = normaliseSlot(n);
          return 1 - distance(q, s) / Math.max(q.length, s.length, 1);
        }),
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0],
    second = scored[1];
  const uniqueTitle = top
    ? active.filter((g) => normaliseSlot(g.name) === normaliseSlot(top.g.name))
        .length === 1
    : false;
  const safe =
    top &&
    q.length >= 5 &&
    (top.score >= 0.88 ||
      (top.score >= 0.8 && distance(q, normaliseSlot(top.g.name)) === 1)) &&
    (!second || top.score - second.score >= 0.12) &&
    uniqueTitle;
  return {
    status: safe ? "matched" : "review",
    game: safe ? top.g : null,
    suggestions: scored
      .filter((x) => x.score >= 0.3)
      .slice(0, 6)
      .map((x) => x.g),
  };
}
