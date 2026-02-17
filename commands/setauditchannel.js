const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setauditchannel')
    .setDescription('Set the channel for command audit logs')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for audit logs (leave empty to disable)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { loadConfig, saveConfig, log }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel');
    const config = loadConfig();

    if (channel) {
      config.auditChannelId = channel.id;
      saveConfig(config);
      log('info', `Set audit channel: #${channel.name} (${channel.id})`);
      await interaction.editReply({ content: `Audit logs will be sent to **#${channel.name}**.` });
    } else {
      config.auditChannelId = null;
      saveConfig(config);
      log('info', 'Audit logging disabled');
      await interaction.editReply({ content: 'Audit logging disabled.' });
    }
  }
};
