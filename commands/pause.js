const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction) {
    const result = music.pause(interaction.guild.id);
    if (!result.ok) {
      return interaction.reply({ content: `❌ ${result.msg}`, flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '⏸️ Paused.' });
  }
};
