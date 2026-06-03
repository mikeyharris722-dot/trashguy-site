Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\mikey\projects\trashguy-site"
WshShell.Run "node scripts\twitch-giveaway-bot.js", 0, False