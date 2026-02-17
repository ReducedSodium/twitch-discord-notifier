const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removestreamer')
    .setDescription('Remove a Twitch streamer from the notification list')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Twitch username')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { loadConfig, saveConfig, log, clearStreamerState }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const username = interaction.options.getString('username').trim().toLowerCase();
    const config = loadConfig();
    config.streamers = config.streamers || [];

    const idx = config.streamers.indexOf(username);
    if (idx === -1) {
      return interaction.editReply({ content: `\`${username}\` is not in the list.` });
    }

    config.streamers.splice(idx, 1);
    if (config.liveMessageIds && config.liveMessageIds[username]) {
      delete config.liveMessageIds[username];
    }
    if (clearStreamerState) clearStreamerState(username);
    saveConfig(config);
    log('info', `Removed streamer: ${username}`);
    await interaction.editReply({ content: `Removed **${username}** from the notification list.` });
  }
};
