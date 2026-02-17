const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstreamer')
    .setDescription('Add a Twitch streamer to the notification list')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Twitch username')
        .setRequired(true)),

  async execute(interaction, { loadConfig, saveConfig, log }) {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username').trim().toLowerCase();
    const config = loadConfig();
    config.streamers = config.streamers || [];

    if (config.streamers.includes(username)) {
      return interaction.editReply({ content: `\`${username}\` is already in the list.` });
    }

    config.streamers.push(username);
    saveConfig(config);
    log('info', `Added streamer: ${username}`);
    await interaction.editReply({ content: `Added **${username}** to the notification list.` });
  }
};
