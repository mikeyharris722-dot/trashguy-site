const tmi = require("tmi.js");

const CHANNEL = "trashguy__";
const API_URL = "http://localhost:3000/api/chat-giveaway/enter";

let enteredUsers = new Set();
const cooldownUsers = new Set();

const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true,
  },
  channels: [CHANNEL],
});

client.connect();

setInterval(async () => {
  try {
    const res = await fetch("http://localhost:3000/api/chat-giveaway");
    const data = await res.json();

    if (data?.giveaway?.status !== "live") {
      enteredUsers = new Set(); // reset when no live giveaway
    }
  } catch (err) {
    console.log("Failed to check giveaway state");
  }
}, 5000);

client.on("message", async (channel, tags, message, self) => {
  if (self) return;

  const text = String(message || "").trim().toLowerCase();

  if (text !== "trash") return;

  const username = String(tags.username || "").toLowerCase();

if (!username) return;

if (enteredUsers.has(username)) {
  console.log(`${username} already entered`);
  return;
}

if (cooldownUsers.has(username)) {
  console.log(`${username} is on cooldown`);
  return;
}

cooldownUsers.add(username);

setTimeout(() => {
  cooldownUsers.delete(username);
}, 10000);

  const displayName = tags["display-name"] || username;
  const twitchId = tags["user-id"] || "";

  if (!username) return;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        display_name: displayName,
        twitch_id: twitchId,
        avatar_url: "",
      }),
    });

    const data = await res.json();

    if (data.ok) {
  console.log(`${displayName} entered giveaway x${data.entry.weight}`);
} else {
      console.log(`${displayName} failed: ${data.error}`);
    }
  } catch (error) {
    console.log("Entry failed:", error.message);
  }
});

console.log(`Listening for "trash" in ${CHANNEL} chat...`);