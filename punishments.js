/**
 * Punishment tracking: log and retrieve warn/kick/ban/timeout history per user.
 * Stored in config.punishments[guildId][userId] as array of { type, reason, by, at, duration? }.
 */

const MAX_PER_USER = 50;

function logPunishment(loadConfig, saveConfig, guildId, userId, entry) {
  const config = loadConfig();
  config.punishments = config.punishments || {};
  config.punishments[guildId] = config.punishments[guildId] || {};
  config.punishments[guildId][userId] = config.punishments[guildId][userId] || [];

  const list = config.punishments[guildId][userId];
  const reason = (entry.reason || 'No reason provided').slice(0, 500);
  list.unshift({
    type: entry.type,
    reason,
    by: entry.by,
    at: entry.at || new Date().toISOString(),
    duration: entry.duration
  });
  if (list.length > MAX_PER_USER) list.length = MAX_PER_USER;
  saveConfig(config);
}

function getPunishments(loadConfig, guildId, userId) {
  const config = loadConfig();
  return config.punishments?.[guildId]?.[userId] || [];
}

module.exports = { logPunishment, getPunishments };
