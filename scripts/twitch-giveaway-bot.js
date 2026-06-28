const tmi = require("tmi.js");
const { createClient } = require("@retconned/kick-js");

const TWITCH_CHANNEL = "trashguy__";
const KICK_CHANNEL = "trashguy";

const API_URL = "https://trashguy.me/api/chat-giveaway/enter";
const SLOT_CALL_API_URL = "https://trashguy.me/api/slot-calls";

let enteredUsers = new Set();
const cooldownUsers = new Set();

function normalizeUsername(username) {
  return String(username || "").replace("@", "").trim().toLowerCase();
}

function entryKey(platform, username) {
  return `${platform}:${normalizeUsername(username)}`;
}

async function submitSlotCall({ platform, username, displayName, message }) {
  const slotName = String(message || "").replace(/^!slot\s+/i, "").trim();
  if (!slotName) return;

  try {
    const res = await fetch(SLOT_CALL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: displayName || username,
        slotName,
        platform,
      }),
    });

    const data = await res.json();

    if (data.ok) {
      console.log(`${displayName} added slot from ${platform}: ${slotName}`);
    } else {
      console.log(`${displayName} slot failed: ${data.error}`);
    }
  } catch (err) {
    console.log("Slot call failed:", err.message);
  }
}

async function enterGiveaway({ platform, username, displayName, twitchId = "" }) {
  username = normalizeUsername(username);
  if (!username) return;

  const key = entryKey(platform, username);

if (cooldownUsers.has(key)) {
  console.log(`${displayName} is on cooldown from ${platform}`);
  return;
}

  cooldownUsers.add(key);
  setTimeout(() => cooldownUsers.delete(key), 10000);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
console.log(`${displayName} entered giveaway from ${platform} x${data.entry.weight}`);
    } else {
      console.log(`${displayName} failed from ${platform}: ${data.error}`);
    }
  } catch (error) {
    console.log(`${platform} entry failed:`, error.message);
  }
}

async function handleChatMessage({ platform, username, displayName, twitchId = "", message }) {
  const rawText = String(message || "").trim();
  const text = rawText.toLowerCase();

  if (text === "trash") {
    await enterGiveaway({ platform, username, displayName, twitchId });
    return;
  }

  if (text.startsWith("!slot ")) {
    await submitSlotCall({
      platform,
      username,
      displayName,
      message: rawText,
    });
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

  console.log("[TWITCH]", tags.username, message);

  await handleChatMessage({
    platform: "twitch",
    username: tags.username,
    displayName: tags["display-name"] || tags.username,
    twitchId: tags["user-id"] || "",
    message,
  });
});

// Kick
async function startKick() {
  const kickClient = createClient(KICK_CHANNEL, {
    logger: false,
    readOnly: true,
  });

  kickClient.on("ChatMessage", async (message) => {
    await handleChatMessage({
      platform: "kick",
      username: message.sender?.username,
      displayName: message.sender?.username,
      message: message.content,
    });
  });

  await kickClient.login();
}

startKick().catch((err) => {
  console.log("Kick bot failed to start:", err.message);
});

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

console.log(`Listening for "trash" and "!slot" in Twitch + Kick chat...`);