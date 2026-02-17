const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = music.pause(interaction.guild.id);
    if (!result.ok) {
      return interaction.editReply({ content: `❌ ${result.msg}` });
    }
    await interaction.editReply({ content: '⏸️ Paused.' });
  }
};
