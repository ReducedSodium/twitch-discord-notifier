const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current song'),

  async execute(interaction) {
    const result = music.resume(interaction.guild.id);
    if (!result.ok) {
      return interaction.reply({ content: `❌ ${result.msg}`, flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '▶️ Resumed.' });
  }
};
