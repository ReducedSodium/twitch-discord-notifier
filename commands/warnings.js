const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('List warnings for a member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, { loadConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const userId = user.id;

    const config = loadConfig();
    const list = config.warnings?.[guildId]?.[userId] || [];

    if (list.length === 0) {
      return interaction.editReply({ content: `**${user.tag}** has no warnings.` });
    }

    const lines = list.map((w, i) => `${i + 1}. ${w.reason} — *${w.by}, ${new Date(w.at).toLocaleDateString()}*`);
    const text = `**${user.tag}** — ${list.length} warning(s):\n${lines.join('\n')}`;
    await interaction.editReply({
      content: text.length > 1900 ? text.slice(0, 1897) + '…' : text
    });
  }
};
