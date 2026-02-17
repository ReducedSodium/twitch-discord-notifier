const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to clear warnings for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, { loadConfig, saveConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const userId = user.id;

    const config = loadConfig();
    config.warnings = config.warnings || {};
    config.warnings[guildId] = config.warnings[guildId] || {};
    const count = (config.warnings[guildId][userId] || []).length;
    delete config.warnings[guildId][userId];
    saveConfig(config);

    await interaction.editReply({
      content: count > 0
        ? `Cleared **${count}** warning(s) for **${user.tag}**.`
        : `**${user.tag}** had no warnings to clear.`
    });
  }
};
