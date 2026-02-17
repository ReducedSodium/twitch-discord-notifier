const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    const result = music.skip(interaction.guild.id);
    if (!result.ok) {
      return interaction.reply({ content: `❌ ${result.msg}`, flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '⏭️ Skipped.' });
  }
};
