const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and disconnect'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = music.stop(interaction.guild.id);
    if (!result.ok) {
      return interaction.editReply({ content: `❌ ${result.msg}` });
    }
    await interaction.editReply({ content: '⏹️ Stopped and disconnected.' });
  }
};
