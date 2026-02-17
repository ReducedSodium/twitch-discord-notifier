const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),

  async execute(interaction) {
    const q = music.getQueue(interaction.guild.id);
    if (!q || (!q.current && q.tracks.length === 0)) {
      return interaction.reply({ content: 'No music playing.', flags: MessageFlags.Ephemeral });
    }

    const lines = [];
    if (q.current) {
      lines.push(`**Now playing:** ${q.current.title}`);
    }
    if (q.tracks.length > 0) {
      lines.push('');
      lines.push(`**Queue (${q.tracks.length}):**`);
      q.tracks.slice(0, 10).forEach((t, i) => {
        lines.push(`${i + 1}. ${t.title}`);
      });
      if (q.tracks.length > 10) {
        lines.push(`... and ${q.tracks.length - 10} more`);
      }
    }
    await interaction.reply({ content: lines.join('\n') || 'Queue is empty.' });
  }
};
