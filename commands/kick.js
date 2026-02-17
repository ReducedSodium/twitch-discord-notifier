const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { logPunishment } = require('../punishments.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to kick')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the kick')
        .setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction, { loadConfig, saveConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ content: 'Could not find that member.' });
    }

    if (!member.kickable) {
      return interaction.editReply({ content: 'I cannot kick this user (they may have higher roles than me).' });
    }

    try {
      await member.kick(reason);
      logPunishment(loadConfig, saveConfig, interaction.guild.id, user.id, {
        type: 'kick',
        reason,
        by: interaction.user.tag
      });
      await interaction.editReply({ content: `Kicked **${user.tag}**. Reason: ${reason}` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to kick: ${err.message}` });
    }
  }
};
