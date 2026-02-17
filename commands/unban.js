const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { logPunishment } = require('../punishments.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID (e.g. after appeal)')
    .addStringOption(opt =>
      opt.setName('user_id')
        .setDescription('Discord user ID to unban')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the unban')
        .setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, { loadConfig, saveConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.options.getString('user_id').trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!/^\d{17,19}$/.test(userId)) {
      return interaction.editReply({ content: 'Invalid user ID. Use a Discord snowflake (17–19 digits).' });
    }

    try {
      await interaction.guild.members.unban(userId, reason);
      logPunishment(loadConfig, saveConfig, interaction.guild.id, userId, {
        type: 'unban',
        reason,
        by: interaction.user.tag
      });
      await interaction.editReply({ content: `Unbanned user **${userId}**. Reason: ${reason}` });
    } catch (err) {
      if (err.code === 10026) {
        return interaction.editReply({ content: 'That user is not banned.' });
      }
      await interaction.editReply({ content: `Failed to unban: ${err.message}` });
    }
  }
};
