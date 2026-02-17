/**
 * Twitch Discord Notifier Bot
 *
 * SETUP INSTRUCTIONS:
 * 1. Copy .env.example to .env and fill in your credentials
 * 2. Install: npm install
 * 3. Run: npm start
 *
 * OBTAINING CREDENTIALS:
 * - Discord: Create app at https://discord.com/developers/applications
 *   Bot -> Reset Token, enable "MESSAGE CONTENT INTENT"
 * - Twitch: Create app at https://dev.twitch.tv/console/apps
 *   Get Client ID and generate Client Secret
 *
 * INVITING THE BOT:
 * - Discord Developer Portal -> OAuth2 -> URL Generator
 * - Scopes: bot, applications.commands
 * - Bot Permissions: Send Messages, Embed Links, Mention Everyone, Use Slash Commands
 * - Use generated URL to invite bot to your server
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, Events, ActivityType } = require('discord.js');

// Validate required env vars before starting
const token = process.env.DISCORD_TOKEN?.trim();
const placeholder = 'your_discord_bot_token';
if (!token || token === placeholder) {
  console.error('[ERROR] DISCORD_TOKEN is not set or still has the placeholder value.');
  console.error('Set DISCORD_TOKEN in your .env file (local) or in your hosting platform\'s environment variables (containers).');
  console.error('Get your bot token from: https://discord.com/developers/applications -> Your App -> Bot -> Reset Token');
  process.exit(1);
}
const twitch = require('./twitch.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DEFAULT_CONFIG = { streamers: [], channelId: null, roleId: null, auditChannelId: null, liveMessageIds: {}, cooldownMinutes: 5 };

let configCache = null;

function loadConfig() {
  if (configCache) return configCache;
  try {
    configCache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return configCache;
  } catch (e) {
    configCache = { ...DEFAULT_CONFIG };
    return configCache;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  configCache = config;
}

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [Bot/${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, message, data || '');
  } else {
    console.log(prefix, message, data || '');
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const AUDIT_VALUE_MAX = 200;

function truncate(val) {
  const s = String(val ?? '');
  return s.length > AUDIT_VALUE_MAX ? s.slice(0, AUDIT_VALUE_MAX - 1) + '…' : s;
}

async function sendAuditLog(interaction, success = true) {
  const config = loadConfig();
  const auditChannelId = config.auditChannelId;
  if (!auditChannelId) return;

  const channel = await client.channels.fetch(auditChannelId).catch(() => null);
  if (!channel) return;

  const opts = interaction.options.data.map(o => {
    const val = o.user ? o.user.tag : o.role ? o.role.name : o.channel ? `#${o.channel.name}` : o.value;
    return `${o.name}: ${truncate(val)}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(success ? 0x57F287 : 0xED4245)
    .setTitle(`/${interaction.commandName}`)
    .addFields(
      { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'Channel', value: `${interaction.channel}`, inline: true },
      { name: 'Status', value: success ? 'Success' : 'Failed', inline: true },
      { name: 'Options', value: opts || '*none*', inline: false }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

// State: streamer -> { notified: true, messageId: '...', lastNotify: timestamp }
const liveState = new Map();
// Cooldown: streamer -> timestamp until we can send again (survives going offline)
const cooldownUntil = new Map();
let hasLoggedNoConfig = false;

function clearStreamerState(login) {
  const key = login.toLowerCase();
  liveState.delete(key);
  cooldownUntil.delete(key);
}

function buildEmbed(streamInfo) {
  const thumb = (streamInfo.thumbnail_url || '').replace('{width}', '1280').replace('{height}', '720');
  const url = `https://twitch.tv/${streamInfo.user_login}`;

  const embed = new EmbedBuilder()
    .setColor(0x9146FF)
    .setTitle(streamInfo.title)
    .setAuthor({
      name: `${streamInfo.user_name} is now live!`,
      iconURL: 'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565f67f0.png',
      url
    })
    .setURL(url)
    .addFields(
      { name: 'Game', value: streamInfo.game_name, inline: true },
      { name: 'Viewers', value: String(streamInfo.viewer_count), inline: true },
      { name: 'Stream', value: `[Watch on Twitch](${url})`, inline: false }
    )
    .setImage(thumb)
    .setTimestamp()
    .setFooter({ text: 'Now Live on Twitch' });

  return embed;
}

async function sendLiveNotification(client, channelId, roleId, streamInfo) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    log('error', `Channel ${channelId} not found`);
    return null;
  }

  const embed = buildEmbed(streamInfo);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Watch Stream')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://twitch.tv/${streamInfo.user_login}`)
  );

  const mention = roleId ? `<@&${roleId}>` : '';
  const content = mention ? `${mention} **${streamInfo.user_name}** is now live!` : `**${streamInfo.user_name}** is now live!`;

  try {
    const msg = await channel.send({
      content,
      embeds: [embed],
      components: [row]
    });
    return msg.id;
  } catch (err) {
    log('error', `Failed to send message to channel: ${err.message}`);
    return null;
  }
}

async function editLiveMessage(client, channelId, messageId, streamInfo) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return;

  const embed = buildEmbed(streamInfo);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Watch Stream')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://twitch.tv/${streamInfo.user_login}`)
  );

  await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
}

function getStreamerList(config) {
  if (config.streamers?.length > 0) return config.streamers;
  const env = process.env.TWITCH_USERNAME?.trim();
  if (!env) return [];
  return env.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

async function checkStreams() {
  const config = loadConfig();
  const streamers = getStreamerList(config);

  const channelId = config.channelId || process.env.CHANNEL_ID?.trim();
  const roleId = config.roleId || process.env.ROLE_ID?.trim();

  if (!channelId || streamers.length === 0) {
    if (!hasLoggedNoConfig) {
      if (streamers.length === 0) log('error', 'No streamers configured. Use /addstreamer or set TWITCH_USERNAME in env.');
      if (!channelId) log('error', 'No channel configured. Use /setchannel or set CHANNEL_ID in env.');
      hasLoggedNoConfig = true;
    }
    return;
  }

  const clientId = process.env.CLIENT_ID?.trim();
  const clientSecret = process.env.CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    log('error', 'Missing CLIENT_ID or CLIENT_SECRET');
    return;
  }

  try {
    const streams = await twitch.getStreams(clientId, clientSecret, streamers);
    const liveLogins = new Set((streams || []).map(s => s.user_login.toLowerCase()));

    if (streams?.length > 0) {
      log('info', `Found ${streams.length} live: ${streams.map(s => s.user_login).join(', ')}`);
    } else if (process.env.DEBUG) {
      log('info', `Checked ${streamers.join(', ')} - none live`);
    }
    const cooldownMin = config.cooldownMinutes || 5;
    const cooldownMs = cooldownMin * 60 * 1000;

    const streamInfos = await twitch.getStreamInfos(clientId, clientSecret, streams || []);
    let configDirty = false;

    for (let i = 0; i < (streams || []).length; i++) {
      const stream = streams[i];
      const streamInfo = streamInfos[i] || await twitch.getStreamInfo(clientId, clientSecret, stream);
      const login = stream.user_login.toLowerCase();
      const state = liveState.get(login);
      const messageId = config.liveMessageIds?.[login];

      if (state && messageId) {
        await editLiveMessage(client, channelId, messageId, streamInfo);
        log('info', `Updated live embed for ${stream.user_name}`);
      } else if (!state || !messageId) {
        if (cooldownUntil.get(login) && Date.now() < cooldownUntil.get(login)) {
          log('info', `Cooldown active for ${stream.user_name}, skipping`);
          continue;
        }
        const msgId = await sendLiveNotification(client, channelId, roleId, streamInfo);
        if (msgId) {
          liveState.set(login, { notified: true, messageId: msgId, lastNotify: Date.now() });
          cooldownUntil.set(login, Date.now() + cooldownMs);
          config.liveMessageIds = config.liveMessageIds || {};
          config.liveMessageIds[login] = msgId;
          configDirty = true;
          log('info', `Sent live notification for ${stream.user_name}`);
        }
      }
    }

    for (const login of liveState.keys()) {
      if (!liveLogins.has(login)) {
        liveState.delete(login);
        if (config.liveMessageIds && config.liveMessageIds[login]) {
          delete config.liveMessageIds[login];
          configDirty = true;
        }
        log('info', `Stream ended for ${login}, reset notification state`);
      }
    }

    if (configDirty) saveConfig(config);

  } catch (err) {
    log('error', 'Stream check failed', err.message);
    if (err.message?.includes('invalid client')) {
      log('info', 'Tip: Set CLIENT_ID and CLIENT_SECRET in your environment (Twitch Developer Console)');
    }
  }
}

async function registerCommands() {
  const guildId = process.env.GUILD_ID;
  if (!guildId) return;

  const commandsPath = path.join(__dirname, 'commands');
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  const commands = [];
  for (const file of files) {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data) commands.push(cmd.data);
  }

  try {
    const rest = client.rest;
    await rest.put(
      `/applications/${client.user.id}/guilds/${guildId}/commands`,
      { body: commands }
    );
    log('info', `Registered ${commands.length} slash commands`);
  } catch (err) {
    log('error', 'Failed to register slash commands', err.message);
  }
}

client.once(Events.ClientReady, async () => {
  log('info', `Logged in as ${client.user.tag}`);
  twitch.setLogger(log);

  await registerCommands();

  const config = loadConfig();
  const streamers = getStreamerList(config);
  const channelId = config.channelId || process.env.CHANNEL_ID?.trim();

  log('info', `Streamers: ${streamers.length ? streamers.join(', ') : 'none (set TWITCH_USERNAME or use /addstreamer)'}`);
  log('info', `Channel: ${channelId || 'not set (set CHANNEL_ID or use /setchannel)'}`);

  // Set bot activity with links if provided
  const twitchLink = process.env.TWITCH_LINK?.trim();
  const youtubeLink = process.env.YOUTUBE_LINK?.trim();
  const discordLink = process.env.DISCORD_LINK?.trim();
  const links = [];
  if (twitchLink) links.push(`Twitch: ${twitchLink}`);
  if (youtubeLink) links.push(`YouTube: ${youtubeLink}`);
  if (discordLink) links.push(`Discord: ${discordLink}`);
  
  if (links.length > 0) {
    const activityText = links.join(' | ');
    // Discord activity text is limited to 128 characters
    const displayText = activityText.length > 128 ? activityText.slice(0, 125) + '...' : activityText;
    client.user.setActivity(displayText, { type: ActivityType.Watching });
    log('info', `Set bot activity: ${displayText}`);
  }

  const interval = (parseInt(process.env.CHECK_INTERVAL, 10) || 60) * 1000;
  setInterval(checkStreams, interval);
  checkStreams();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const commandsPath = path.join(__dirname, 'commands');
  const file = `${interaction.commandName}.js`;
  const filePath = path.join(commandsPath, file);

  if (!fs.existsSync(filePath)) return;

  let success = true;
  try {
    const cmd = require(filePath);
    if (cmd.execute) await cmd.execute(interaction, { loadConfig, saveConfig, log, clearStreamerState });
  } catch (err) {
    success = false;
    log('error', `Command ${interaction.commandName} failed`, err.message);
    const payload = { content: 'An error occurred.', flags: MessageFlags.Ephemeral };
    await interaction.editReply(payload).catch(() => interaction.reply(payload).catch(() => {}));
  } finally {
    sendAuditLog(interaction, success);
  }
});

const music = require('./music.js');

function shutdown() {
  log('info', 'Shutting down...');
  music.shutdown?.();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(token).catch(err => {
  log('error', 'Login failed', err.message);
  if (err.message?.includes('invalid token')) {
    console.error('[TIP] Reset your token at Discord Developer Portal -> Bot -> Reset Token, then update DISCORD_TOKEN.');
  }
  process.exit(1);
});
