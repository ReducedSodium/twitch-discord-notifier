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
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

// Load config with graceful fallback
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return { streamers: [], channelId: null, roleId: null, liveMessageIds: {}, cooldownMinutes: 5 };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
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
  intents: [GatewayIntentBits.Guilds]
});

// State: streamer -> { notified: true, messageId: '...', lastNotify: timestamp }
const liveState = new Map();
// Cooldown: streamer -> timestamp until we can send again (survives going offline)
const cooldownUntil = new Map();

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

  const msg = await channel.send({
    content,
    embeds: [embed],
    components: [row]
  });
  return msg.id;
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

async function checkStreams() {
  const config = loadConfig();
  const streamers = config.streamers && config.streamers.length > 0
    ? config.streamers
    : (process.env.TWITCH_USERNAME ? [process.env.TWITCH_USERNAME] : []);

  const channelId = config.channelId || process.env.CHANNEL_ID;
  const roleId = config.roleId || process.env.ROLE_ID;

  if (!channelId || streamers.length === 0) return;

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    log('error', 'Missing CLIENT_ID or CLIENT_SECRET');
    return;
  }

  try {
    const streams = await twitch.getStreams(clientId, clientSecret, streamers);
    const liveLogins = new Set((streams || []).map(s => s.user_login.toLowerCase()));
    const cooldownMin = config.cooldownMinutes || 5;
    const cooldownMs = cooldownMin * 60 * 1000;

    for (const stream of streams || []) {
      const login = stream.user_login.toLowerCase();
      const state = liveState.get(login);
      const streamInfo = await twitch.getStreamInfo(clientId, clientSecret, stream);

      if (state) {
        if (config.liveMessageIds && config.liveMessageIds[login]) {
          await editLiveMessage(client, channelId, config.liveMessageIds[login], streamInfo);
          log('info', `Updated live embed for ${stream.user_name}`);
        }
      } else {
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
          saveConfig(config);
          log('info', `Sent live notification for ${stream.user_name}`);
        }
      }
    }

    for (const login of liveState.keys()) {
      if (!liveLogins.has(login)) {
        liveState.delete(login);
        if (config.liveMessageIds && config.liveMessageIds[login]) {
          delete config.liveMessageIds[login];
          saveConfig(config);
        }
        log('info', `Stream ended for ${login}, reset notification state`);
      }
    }

  } catch (err) {
    log('error', 'Stream check failed', err.message);
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

  const rest = client.rest;
  await rest.put(
    `/applications/${client.user.id}/guilds/${guildId}/commands`,
    { body: commands }
  );
  log('info', `Registered ${commands.length} slash commands`);
}

client.once('ready', async () => {
  log('info', `Logged in as ${client.user.tag}`);

  await registerCommands();

  const config = loadConfig();
  const streamers = config.streamers?.length > 0
    ? config.streamers
    : (process.env.TWITCH_USERNAME ? [process.env.TWITCH_USERNAME] : []);

  if (streamers.length > 0) {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    try {
      const streams = await twitch.getStreams(clientId, clientSecret, streamers);
      for (const s of streams || []) {
        liveState.set(s.user_login.toLowerCase(), {
          notified: true,
          messageId: config.liveMessageIds?.[s.user_login.toLowerCase()],
          lastNotify: Date.now()
        });
      }
      if (streams?.length > 0) {
        log('info', `Startup: ${streams.length} streamer(s) already live, will not re-notify`);
      }
    } catch (e) {
      log('error', 'Startup stream check failed', e.message);
    }
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

  try {
    const cmd = require(filePath);
    if (cmd.execute) await cmd.execute(interaction, { loadConfig, saveConfig, log });
  } catch (err) {
    log('error', `Command ${interaction.commandName} failed`, err.message);
    await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
  }
});

client.login(token).catch(err => {
  log('error', 'Login failed', err.message);
  if (err.message?.includes('invalid token')) {
    console.error('[TIP] Reset your token at Discord Developer Portal -> Bot -> Reset Token, then update DISCORD_TOKEN.');
  }
  process.exit(1);
});
