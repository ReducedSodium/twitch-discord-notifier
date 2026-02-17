const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const twitch = require('../twitch.js');

const MAX_STREAMERS = 50;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstreamer')
    .setDescription('Add a Twitch streamer to the notification list')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Twitch username')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { loadConfig, saveConfig, log }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const username = interaction.options.getString('username').trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{1,25}$/.test(username)) {
      return interaction.editReply({ content: 'Invalid Twitch username (1–25 letters, numbers, underscores).' });
    }

    const config = loadConfig();
    config.streamers = config.streamers || [];

    if (config.streamers.includes(username)) {
      return interaction.editReply({ content: `\`${username}\` is already in the list.` });
    }
    if (config.streamers.length >= MAX_STREAMERS) {
      return interaction.editReply({ content: `Maximum ${MAX_STREAMERS} streamers. Remove one with \`/removestreamer\` first.` });
    }

    const clientId = process.env.CLIENT_ID?.trim();
    const clientSecret = process.env.CLIENT_SECRET?.trim();
    if (clientId && clientSecret) {
      try {
        const users = await twitch.getUsers(clientId, clientSecret, [username]);
        if (!users || users.length === 0) {
          return interaction.editReply({ content: `No Twitch user found for \`${username}\`.` });
        }
      } catch (err) {
        log('error', `Twitch validation failed for ${username}`, err.message);
      }
    }

    config.streamers.push(username);
    saveConfig(config);
    log('info', `Added streamer: ${username}`);
    await interaction.editReply({ content: `Added **${username}** to the notification list.` });
  }
};
