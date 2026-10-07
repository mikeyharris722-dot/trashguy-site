// Parse only source JSON and static asset declarations; never execute downloaded JavaScript.
export function artworkIndex(source: string) {
  const marker = source.indexOf("229436:(e,t,a)=>{var s=");
  if (marker < 0) throw new Error("Artwork source format changed");
  const start = source.indexOf("{", marker + "229436:(e,t,a)=>{var s=".length),
    end = source.indexOf("};", start);
  const context = JSON.parse(source.slice(start, end + 1)) as Record<
    string,
    number
  >;
  const modules = new Map(
    [
      ...source.matchAll(
        /(\d+):\(e,t,a\)=>\{"use strict";e\.exports=a\.p\+"(static\/media\/[^"]+)"\}/g,
      ),
    ].map((m) => [m[1], m[2]]),
  );
  const index = new Map<string, string>();
  for (const [key, module] of Object.entries(context)) {
    const parts = key.replace(/^\.\//, "").split("/");
    if (parts.length < 2) continue;
    const stem = parts[parts.length - 1]
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const asset = modules.get(String(module));
    if (asset)
      index.set(parts[0] + ":" + stem, "https://roulobets.com/" + asset);
  }
  return index;
}
export function findArtwork(
  index: Map<string, string>,
  game: {
    identifier: string;
    identifier2?: unknown;
    provider: string;
    producer?: string;
  },
) {
  const aliases: Record<string, string> = {
    bgmng: "softswiss",
    pragmaticexternal: "pragmatic",
    nolimitcity: "nolimit",
    hacksawg: "hacksaw",
    hackawg: "hacksaw",
    quickspin: "quickspins",
    amigogaming: "amigo",
    petersons: "peterandsons",
    evoplayentertainment: "evoplay",
    maxwingaming: "redtiger",
  };
  const providers = [game.provider, game.producer || ""].map((p) => {
    const v = p.toLowerCase().replace(/[^a-z0-9]/g, "");
    return aliases[v] || v;
  });
  const id =
    providers.includes("pragmatic") && game.identifier2
      ? String(game.identifier2)
      : game.identifier.split(":").pop() || "";
  const key = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  return providers.map((p) => index.get(p + ":" + key)).find(Boolean) || null;
}
export async function refreshArtworkIndex() {
  const response = await fetch("https://roulobets.com/casino/slots", {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Artwork listing unavailable");
  const html = await response.text();
  const path = html.match(/src="(\/static\/js\/main\.[a-z0-9]+\.js)"/i)?.[1];
  if (!path) throw new Error("Artwork bundle not found");
  const asset = await fetch("https://roulobets.com" + path, {
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!asset.ok) throw new Error("Artwork mapping unavailable");
  const source = await asset.text();
  if (source.length > 35000000) throw new Error("Artwork mapping too large");
  return artworkIndex(source);
}
