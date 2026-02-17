const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and disconnect'),

  async execute(interaction) {
    const result = music.stop(interaction.guild.id);
    if (!result.ok) {
      return interaction.reply({ content: `❌ ${result.msg}`, flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '⏹️ Stopped and disconnected.' });
  }
};
