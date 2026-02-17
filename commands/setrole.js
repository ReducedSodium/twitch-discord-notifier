const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Set the role to ping when a streamer goes live')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role to ping')
        .setRequired(true)),

  async execute(interaction, { loadConfig, saveConfig, log }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole('role');
    const config = loadConfig();
    config.roleId = role.id;
    saveConfig(config);
    log('info', `Set notification role: ${role.name} (${role.id})`);
    await interaction.editReply({ content: `Notification role set to **${role.name}**.` });
  }
};
