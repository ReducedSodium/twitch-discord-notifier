/**
 * Music player module - handles voice connection, queue, and playback
 * Uses @discordjs/voice and play-dl for YouTube streaming
 */

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection
} = require('@discordjs/voice');
const play = require('play-dl');

const queues = new Map(); // guildId -> { connection, player, queue: [{title, url}], current, channel }

function getOrCreateQueue(guildId, voiceChannel, textChannel) {
  if (queues.has(guildId)) {
    return queues.get(guildId);
  }
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  const queue = {
    connection,
    player,
    tracks: [],
    current: null,
    textChannel,
    voiceChannel
  };
  queues.set(guildId, queue);

  player.on(AudioPlayerStatus.Idle, () => {
    if (queue.tracks.length > 0) {
      playNext(guildId);
    } else {
      queue.current = null;
      setTimeout(() => {
        if (queue.player.state.status === AudioPlayerStatus.Idle && queue.tracks.length === 0) {
          connection.destroy();
          queues.delete(guildId);
        }
      }, 60000);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    queues.delete(guildId);
  });

  return queue;
}

async function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q || q.tracks.length === 0) return;

  const track = q.tracks.shift();
  q.current = track;

  try {
    const stream = await play.stream(track.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    q.player.play(resource);
  } catch (err) {
    if (q.textChannel) {
      q.textChannel.send({ content: `Failed to play **${track.title}**: ${err.message}` }).catch(() => {});
    }
    playNext(guildId);
  }
}

async function addTrack(guildId, voiceChannel, textChannel, query) {
  const q = getOrCreateQueue(guildId, voiceChannel, textChannel);

  try {
    let info;
    const isUrl = /^https?:\/\//.test(query.trim());
    if (isUrl) {
      const vi = await play.video_info(query);
      if (!vi?.video_details) return { found: false, msg: 'Invalid or unsupported URL.' };
      info = { title: vi.video_details.title, url: vi.video_details.url };
    } else {
      const search = await play.search(query, { limit: 1 });
      if (!search || search.length === 0) return { found: false, msg: 'No results found.' };
      info = search[0];
    }
    const track = { title: info.title || 'Unknown', url: info.url };

    if (q.player.state.status === AudioPlayerStatus.Idle && !q.current) {
      q.current = track;
      const stream = await play.stream(track.url, { discordPlayerCompatibility: true });
      const resource = createAudioResource(stream.stream, { inputType: stream.type });
      q.player.play(resource);
      return { found: true, track, playing: true };
    } else {
      q.tracks.push(track);
      return { found: true, track, playing: false, position: q.tracks.length };
    }
  } catch (err) {
    return { found: false, msg: err.message };
  }
}

function skip(guildId) {
  const q = queues.get(guildId);
  if (!q) return { ok: false, msg: 'Nothing playing.' };
  q.player.stop();
  return { ok: true };
}

function stop(guildId) {
  const q = queues.get(guildId);
  if (!q) return { ok: false, msg: 'Nothing playing.' };
  q.tracks.length = 0;
  q.current = null;
  q.player.stop();
  q.connection.destroy();
  queues.delete(guildId);
  return { ok: true };
}

function pause(guildId) {
  const q = queues.get(guildId);
  if (!q) return { ok: false, msg: 'Nothing playing.' };
  q.player.pause();
  return { ok: true };
}

function resume(guildId) {
  const q = queues.get(guildId);
  if (!q) return { ok: false, msg: 'Nothing playing.' };
  q.player.unpause();
  return { ok: true };
}

function getQueue(guildId) {
  return queues.get(guildId);
}

module.exports = { addTrack, skip, stop, pause, resume, getQueue };
