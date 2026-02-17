const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getPunishments } = require('../punishments.js');

const TYPE_LABELS = { warn: '⚠️ Warn', kick: '👢 Kick', ban: '🔨 Ban', unban: '🔓 Unban', timeout: '⏱️ Timeout' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('punishments')
    .setDescription('View punishment history for a member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, { loadConfig }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const list = getPunishments(loadConfig, guildId, user.id);

    if (list.length === 0) {
      return interaction.editReply({ content: `**${user.tag}** has no recorded punishments.` });
    }

    const lines = list.map((p, i) => {
      const label = TYPE_LABELS[p.type] || p.type;
      const extra = p.duration != null ? ` (${p.duration} min)` : '';
      return `${i + 1}. **${label}**${extra} — ${p.reason}\n   *${p.by}, ${new Date(p.at).toLocaleString()}*`;
    });
    const text = `**${user.tag}** — ${list.length} punishment(s):\n\n${lines.join('\n\n')}`;
    await interaction.editReply({
      content: text.length > 1900 ? text.slice(0, 1897) + '…' : text
    });
  }
};
