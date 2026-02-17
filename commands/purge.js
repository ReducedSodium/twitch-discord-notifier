const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages in this channel')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Only delete messages from this user'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    try {
      let deleted;
      if (targetUser) {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const toDelete = messages.filter(m => m.author.id === targetUser.id).first(amount);
        if (toDelete.length === 0) {
          return interaction.editReply({ content: `No recent messages from **${targetUser.tag}** (max 100 msgs, 14 days).` });
        }
        deleted = await interaction.channel.bulkDelete(toDelete, true);
      } else {
        deleted = await interaction.channel.bulkDelete(amount, true);
      }

      await interaction.editReply({ content: `Deleted **${deleted.size}** message(s).` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to purge: ${err.message}` });
    }
  }
};
