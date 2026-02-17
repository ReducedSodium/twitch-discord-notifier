const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = music.skip(interaction.guild.id);
    if (!result.ok) {
      return interaction.editReply({ content: `❌ ${result.msg}` });
    }
    await interaction.editReply({ content: '⏭️ Skipped.' });
  }
};
