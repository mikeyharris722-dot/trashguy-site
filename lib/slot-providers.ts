export const FEATURED_PROVIDERS = [
  "BGaming",
  "Backseat Gaming",
  "Bullshark Games",
  "Hacksaw Gaming",
  "NetEnt",
  "NoLimit City",
  "Peter & Sons",
  "Popiplay",
  "Pragmatic Play",
  "Shady Lady",
];
const labels: Record<string, string> = {
  "1spin4win": "1spin4win",
  "3oaks": "3 Oaks Gaming",
  amigo: "Amigo Gaming",
  amigogaming: "Amigo Gaming",
  avatarux: "AvatarUX",
  belatra: "Belatra",
  bgmng: "BGaming",
  bgaming: "BGaming",
  booming: "Booming Games",
  bsg: "Betsoft",
  betsoft: "Betsoft",
  caleta: "Caleta Gaming",
  clawbuster: "Clawbuster",
  endorphina: "Endorphina",
  evolution: "Evolution Gaming",
  ezugi: "Ezugi",
  fantasma: "Fantasma Games",
  habanero: "Habanero",
  hacksaw: "Hacksaw Gaming",
  hacksawg: "Hacksaw Gaming",
  kalamba: "Kalamba Games",
  n2games: "N2 Games",
  netgame: "NetGame",
  nolimit: "NoLimit City",
  nolimitcity: "NoLimit City",
  onetouch: "OneTouch",
  peterandsons: "Peter & Sons",
  petersons: "Peter & Sons",
  pgsoft: "PG Soft",
  platipus: "Platipus",
  playngo: "Play'n GO",
  popiplay: "Popiplay",
  pragmaticexternal: "Pragmatic Play",
  pragmatic: "Pragmatic Play",
  quickspin: "Quickspin",
  shadylady: "Shady Lady",
  smartsoft: "SmartSoft Gaming",
  softswiss: "SOFTSWISS",
  spnmnl: "Spinomenal",
  spinomenal: "Spinomenal",
  voltent: "VoltEnt",
  yggdrasil: "Yggdrasil",
  zillion: "Zillion Games",
  backseat: "Backseat Gaming",
  backseatgaming: "Backseat Gaming",
  bullshark: "Bullshark Games",
  bullsharkgames: "Bullshark Games",
  nownow: "NowNow Gaming",
  netent: "NetEnt",
  redtiger: "Red Tiger",
  maxwingaming: "Red Tiger",
};
export function providerName(provider: string, producer?: string) {
  const p = provider.toLowerCase().replace(/[^a-z0-9]/g, ""),
    studio = (producer || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    (p === "hacksaw" || p === "hacksawg") &&
    [
      "backseat",
      "backseatgaming",
      "bullsharkgames",
      "bullshark",
      "nownow",
    ].includes(studio)
  )
    return labels[studio];
  if (
    p === "evolution" &&
    ["netent", "redtiger", "maxwingaming", "nolimit", "ezugi"].includes(studio)
  )
    return labels[studio];
  if (p === "softswiss" && studio === "bgaming") return "BGaming";
  return (
    labels[p] ||
    provider.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
export const featuredLogos: Record<string, string> = {
  BGaming: "/providers/bgaming.svg",
  "Backseat Gaming": "/providers/backseatgaming.svg",
  "Bullshark Games": "/providers/bullshark.png",
  "Hacksaw Gaming": "/providers/hacksaw.svg",
  NetEnt: "/providers/netent.png",
  "NoLimit City": "/providers/nolimit.png",
  "Peter & Sons": "/providers/petersons.svg",
  Popiplay: "/providers/popiplay.svg",
  "Pragmatic Play": "/providers/pragmaticplay.svg",
  "Shady Lady": "/providers/shadylady.svg",
};
