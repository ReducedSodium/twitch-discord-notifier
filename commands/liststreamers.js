const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liststreamers')
    .setDescription('List all Twitch streamers being monitored'),

  async execute(interaction, { loadConfig, log }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = loadConfig();
    const streamers = config.streamers || [];

    if (streamers.length === 0) {
      return interaction.editReply({ content: 'No streamers in the list. Use `/addstreamer <username>` to add one.' });
    }

    const list = streamers.map(s => `• **${s}**`).join('\n');
    await interaction.editReply({
      content: `**Monitored Streamers** (${streamers.length})\n\n${list}`
    });
  }
};
