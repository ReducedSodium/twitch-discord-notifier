const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { logPunishment } = require('../punishments.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (no send messages for a duration)')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to timeout')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('minutes')
        .setDescription('Duration in minutes (max 40320 = 28 days)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the timeout')
        .setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, { loadConfig, saveConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const durationMs = minutes * 60 * 1000;

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ content: 'Could not find that member.' });
    }

    if (!member.moderatable) {
      return interaction.editReply({ content: 'I cannot timeout this user (they may have higher roles than me).' });
    }

    try {
      await member.timeout(durationMs, reason);
      logPunishment(loadConfig, saveConfig, interaction.guild.id, user.id, {
        type: 'timeout',
        reason,
        by: interaction.user.tag,
        duration: minutes
      });
      await interaction.editReply({ content: `Timed out **${user.tag}** for ${minutes} minute(s). Reason: ${reason}` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to timeout: ${err.message}` });
    }
  }
};
