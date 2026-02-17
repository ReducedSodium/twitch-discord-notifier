# Twitch Discord Notifier

A Discord bot that monitors Twitch streamers and sends embed notifications when they go live. Supports multiple streamers, slash commands, live embed updates, and configurable cooldowns.

## Features

- **Multiple Streamer Support** – Monitor any number of Twitch usernames
- **Slash Commands** – Stream notifier, moderation (`/kick`, `/ban`, `/timeout`, `/purge`), status
- **Live Update Editing** – Edits the same embed to update viewer count and title instead of spamming messages
- **Cooldown System** – Prevents duplicate alerts if a streamer rapidly disconnects and reconnects
- **Config Persistence** – Streamer list and settings stored in `config.json`, auto-loaded on startup
- **Graceful Startup** – If the bot restarts while a streamer is live, it won’t send a duplicate notification
- **Auto Token Refresh** – Twitch OAuth tokens are refreshed automatically when they expire
- **Logging** – Timestamped console logs for live events, offline events, token refreshes, and errors

## Tech Stack

- **Node.js** (latest LTS)
- **discord.js** (v14)
- **@discordjs/voice** + **yt-dlp** for music (bypasses YouTube bot detection)
- **Twitch Helix API**
- **dotenv** for environment variables
- Native **fetch** (Node 18+)
- **FFmpeg** (required for music – install on your system)

## Quick Start

### 1. Install Dependencies

```bash
cd twitch-discord-notifier
npm install
```

### 2. Environment Variables

Copy the example file and fill in your credentials:

```bash
copy .env.example .env
```

Required variables in `.env`:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `CLIENT_ID` | Twitch application client ID |
| `CLIENT_SECRET` | Twitch application client secret |
| `GUILD_ID` | Discord server (guild) ID |
| `CHANNEL_ID` | Channel for stream notifications (can be overridden via `/setchannel`) |
| `ROLE_ID` | Role to ping for live alerts (can be overridden via `/setrole`) |
| `TWITCH_USERNAME` | Optional default streamer to monitor |
| `CHECK_INTERVAL` | Optional; polling interval in seconds (default: 60) |

### 3. Run the Bot

```bash
npm start
```

## Obtaining Credentials

### Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and name it
3. Open the **Bot** tab and click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it (this is `DISCORD_TOKEN`)
5. Enable **MESSAGE CONTENT INTENT** under Privileged Gateway Intents

### Inviting the Bot to Your Server

1. In the Discord Developer Portal, open your application
2. Go to **OAuth2** → **URL Generator**
3. Select scopes: `bot`, `applications.commands`
4. Select bot permissions:
   - Send Messages  
   - Embed Links  
   - Mention Everyone (to ping roles)  
   - Use Slash Commands  
   - Kick Members, Ban Members, Moderate Members, Manage Messages (for moderation commands)  
   - Connect, Speak (for music commands)  
5. Copy the generated URL and open it in a browser to invite the bot to your server

### Getting Guild ID, Channel ID, and Role ID

- **Guild ID**: Right‑click your server icon → **Copy Server ID** (enable Developer Mode in User Settings → App Settings)
- **Channel ID**: Right‑click the channel → **Copy Channel ID**
- **Role ID**: Server Settings → Roles → Right‑click the role → **Copy Role ID**

### Twitch API Credentials

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click **Register Your Application**
3. Fill in:
   - **Name**: e.g. "My Discord Notifier"
   - **OAuth Redirect URLs**: `http://localhost` (required by Twitch; not used for app-only auth)
   - **Category**: e.g. "Application Integration"
4. Click **Create** and then **Manage**
5. Copy the **Client ID** and generate a **Client Secret**

## Slash Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/addstreamer <username>` | Add a Twitch username to the monitor list (max 50) | Administrator |
| `/removestreamer <username>` | Remove a username from the list | Administrator |
| `/liststreamers` | List all monitored streamers | Administrator |
| `/setchannel <channel>` | Set the channel for stream notifications | Administrator |
| `/setrole <role>` | Set the role to ping when someone goes live | Administrator |
| `/setauditchannel [channel]` | Set channel for command audit logs (omit to disable) | Administrator |
| `/status` | Check bot configuration and connection status | Anyone |
| `/kick <user> [reason]` | Kick a member | Kick Members |
| `/ban <user> [reason]` | Ban a member | Ban Members |
| `/unban <user_id> [reason]` | Unban a user by ID | Ban Members |
| `/timeout <user> <minutes> [reason]` | Timeout a member | Moderate Members |
| `/warn <user> [reason]` | Warn a member (stored in config) | Moderate Members |
| `/warnings <user>` | List warnings for a member | Moderate Members |
| `/punishments <user>` | View full punishment history (warn/kick/ban/timeout/unban) | Moderate Members |
| `/clearwarnings <user>` | Clear all warnings for a member | Moderate Members |
| `/clearpunishments <user>` | Clear punishment history for a member | Moderate Members |
| `/purge <amount> [user]` | Delete recent messages (optionally from one user) | Manage Messages |
| `/play <query>` | Play a song from YouTube (must be in same VC as bot when queue active) | Anyone |
| `/skip` | Skip current song | Anyone |
| `/stop` | Stop and disconnect | Anyone |
| `/queue` | Show music queue | Anyone |
| `/pause` | Pause playback | Anyone |
| `/resume` | Resume playback | Anyone |

## Project Structure

```
twitch-discord-notifier/
├── index.js          # Main bot entry, Discord client, polling loop
├── twitch.js         # Twitch Helix API, OAuth, stream fetching
├── commands/         # Slash command handlers
│   ├── addstreamer.js
│   ├── removestreamer.js
│   ├── liststreamers.js
│   ├── setrole.js
│   └── setchannel.js
├── config.json       # Persisted streamer list and settings
├── .env.example      # Environment variable template
├── .env              # Your credentials (create from .env.example)
├── package.json
└── README.md
```

## Container Deployment (Docker / Railway / Render)

A `Dockerfile` is included. When running in a container, **set environment variables in your hosting platform** — the `.env` file is not used in Docker builds.

1. Add `DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `GUILD_ID`, `CHANNEL_ID`, `ROLE_ID` in your platform's environment variable settings.
2. Build and run (or let the platform auto-detect the Dockerfile).

## How It Works

1. Every `CHECK_INTERVAL` seconds, the bot polls the Twitch Helix API for all monitored streamers.
2. When a streamer goes live for the first time, it sends an embed in the configured channel and pings the configured role.
3. While the stream is live, the same embed is edited to update viewer count and title (instead of sending new messages).
4. When the stream ends, the notification state is reset so a future go‑live will trigger a new alert.
5. A cooldown prevents duplicate notifications if a streamer goes offline and back online within a few minutes.

## License

MIT
