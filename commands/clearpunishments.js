const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearpunishments')
    .setDescription('Clear punishment history for a member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to clear punishment history for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, { loadConfig, saveConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const userId = user.id;

    const config = loadConfig();
    config.punishments = config.punishments || {};
    config.punishments[guildId] = config.punishments[guildId] || {};
    const count = (config.punishments[guildId][userId] || []).length;
    delete config.punishments[guildId][userId];
    saveConfig(config);

    await interaction.editReply({
      content: count > 0
        ? `Cleared **${count}** punishment record(s) for **${user.tag}**.`
        : `**${user.tag}** had no punishment history to clear.`
    });
  }
};
