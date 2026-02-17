const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { logPunishment } = require('../punishments.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member (stored in bot config)')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to warn')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the warning')
        .setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, { loadConfig, saveConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guildId = interaction.guild.id;
    const userId = user.id;

    const config = loadConfig();
    config.warnings = config.warnings || {};
    config.warnings[guildId] = config.warnings[guildId] || {};
    config.warnings[guildId][userId] = config.warnings[guildId][userId] || [];
    config.warnings[guildId][userId].push({
      reason,
      at: new Date().toISOString(),
      by: interaction.user.tag
    });
    saveConfig(config);

    logPunishment(loadConfig, saveConfig, guildId, userId, {
      type: 'warn',
      reason,
      by: interaction.user.tag
    });

    const count = config.warnings[guildId][userId].length;
    await interaction.editReply({
      content: `⚠️ Warned **${user.tag}**. Reason: ${reason}\nThey now have **${count}** warning(s).`
    });
  }
};
