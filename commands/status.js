const { SlashCommandBuilder, MessageFlags } = require('discord.js');

function getStreamerList(config) {
  if (config.streamers?.length > 0) return config.streamers;
  const env = process.env.TWITCH_USERNAME?.trim();
  if (!env) return [];
  return env.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check bot configuration and connection status'),

  async execute(interaction, { loadConfig, log }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = loadConfig();
    const streamers = getStreamerList(config);
    const channelId = config.channelId || process.env.CHANNEL_ID?.trim();
    const roleId = config.roleId || process.env.ROLE_ID?.trim();
    const hasTwitch = !!(process.env.CLIENT_ID?.trim() && process.env.CLIENT_SECRET?.trim());

    const lines = [
      '**Bot Status**',
      '',
      `**Streamers:** ${streamers.length ? streamers.join(', ') : '❌ None (use /addstreamer or set TWITCH_USERNAME)'}`,
      `**Channel:** ${channelId ? `✅ <#${channelId}>` : '❌ Not set (use /setchannel or CHANNEL_ID)'}`,
      `**Role:** ${roleId ? `✅ <@&${roleId}>` : '⚪ Optional'}`,
      `**Twitch API:** ${hasTwitch ? '✅ Configured' : '❌ Missing CLIENT_ID or CLIENT_SECRET'}`,
      '',
      'All checks run every 60 seconds. Go live on Twitch to trigger a notification.'
    ];

    await interaction.editReply({ content: lines.join('\n') });
  }
};
