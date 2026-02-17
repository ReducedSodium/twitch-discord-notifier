const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the channel for stream notifications')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for notifications')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { loadConfig, saveConfig, log }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel');
    const config = loadConfig();
    config.channelId = channel.id;
    saveConfig(config);
    log('info', `Set notification channel: #${channel.name} (${channel.id})`);
    await interaction.editReply({ content: `Notifications will be sent to **#${channel.name}**.` });
  }
};
