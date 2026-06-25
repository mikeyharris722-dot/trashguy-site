const tmi = require("tmi.js");
const { createClient } = require("@retconned/kick-js");

const TWITCH_CHANNEL = "trashguy__";
const KICK_CHANNEL = "trashguy";

const API_URL = "https://trashguy.me/api/chat-giveaway/enter";

let enteredUsers = new Set();
const cooldownUsers = new Set();

function normalizeUsername(username) {
  return String(username || "").replace("@", "").trim().toLowerCase();
}

function entryKey(platform, username) {
  return `${platform}:${normalizeUsername(username)}`;
}

async function enterGiveaway({ platform, username, displayName, twitchId = "" }) {
  username = normalizeUsername(username);
  if (!username) return;

  const key = entryKey(platform, username);

  if (enteredUsers.has(key)) {
    console.log(`${displayName} already entered from ${platform}`);
    return;
  }

  if (cooldownUsers.has(key)) {
    console.log(`${displayName} is on cooldown from ${platform}`);
    return;
  }

  cooldownUsers.add(key);
  setTimeout(() => cooldownUsers.delete(key), 10000);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        display_name: displayName || username,
        twitch_id: twitchId,
        avatar_url: "",
        platform,
      }),
    });

    const data = await res.json();

    if (data.ok) {
      enteredUsers.add(key);
      console.log(`${displayName} entered giveaway from ${platform} x${data.entry.weight}`);
    } else {
      console.log(`${displayName} failed from ${platform}: ${data.error}`);
    }
  } catch (error) {
    console.log(`${platform} entry failed:`, error.message);
  }
}

// Twitch
const twitchClient = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true,
  },
  channels: [TWITCH_CHANNEL],
});

twitchClient.connect();

twitchClient.on("message", async (channel, tags, message, self) => {
  if (self) return;

  const text = String(message || "").trim().toLowerCase();
  if (text !== "trash") return;

  await enterGiveaway({
    platform: "twitch",
    username: tags.username,
    displayName: tags["display-name"] || tags.username,
    twitchId: tags["user-id"] || "",
  });
});

// Kick
async function startKick() {
  const kickClient = createClient(KICK_CHANNEL, {
    logger: false,
    readOnly: true,
  });

  kickClient.on("ready", () => {
    console.log(`Listening for "trash" in ${KICK_CHANNEL} Kick chat...`);
  });

  kickClient.on("ChatMessage", async (message) => {
    const text = String(message.content || "").trim().toLowerCase();
    if (text !== "trash") return;

    await enterGiveaway({
      platform: "kick",
      username: message.sender?.username,
      displayName: message.sender?.username,
    });
  });

  await kickClient.login();
}

// Reset entries when giveaway is no longer live
setInterval(async () => {
  try {
    const res = await fetch("https://trashguy.me/api/chat-giveaway");
    const data = await res.json();

    if (data?.giveaway?.status !== "live") {
      enteredUsers = new Set();
    }
  } catch (err) {
    console.log("Failed to check giveaway state");
  }
}, 5000);

console.log(`Listening for "trash" in ${TWITCH_CHANNEL} Twitch chat...`);