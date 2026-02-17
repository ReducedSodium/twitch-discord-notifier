const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song name or YouTube URL')
        .setRequired(true)),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: 'You must be in a voice channel to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const query = interaction.options.getString('query');
    const result = await music.addTrack(
      interaction.guild.id,
      voiceChannel,
      interaction.channel,
      query
    );

    if (!result.found) {
      return interaction.editReply({ content: `❌ ${result.msg}` });
    }

    if (result.playing) {
      return interaction.editReply({ content: `▶️ Now playing **${result.track.title}**` });
    }
    return interaction.editReply({
      content: `➕ Added **${result.track.title}** to queue (position ${result.position})`
    });
  }
};
