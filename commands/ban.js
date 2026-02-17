const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to ban')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the ban'))
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Delete messages from the last X days (0-7)')
        .setMinValue(0)
        .setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.editReply({ content: 'I cannot ban this user (they may have higher roles than me).' });
    }

    try {
      await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: deleteDays * 24 * 60 * 60 });
      await interaction.editReply({ content: `Banned **${user.tag}**. Reason: ${reason}` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to ban: ${err.message}` });
    }
  }
};
