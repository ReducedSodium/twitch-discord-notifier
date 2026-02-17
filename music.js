/**
 * Music player module - handles voice connection, queue, and playback
 * Uses @discordjs/voice and yt-dlp for YouTube streaming (bypasses bot detection)
 */

const { spawn } = require('child_process');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType
} = require('@discordjs/voice');

const queues = new Map(); // guildId -> { connection, player, queue: [{title, url}], current, channel }

// Use android client for search/extraction (often bypasses YouTube bot detection)
const YT_EXTRACTOR_ARGS = ['--extractor-args', 'youtube:player_client=android'];

function createYtDlpStream(url) {
  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio/best',
    '-o', '-',
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    ...YT_EXTRACTOR_ARGS,
    url
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const ffmpeg = spawn('ffmpeg', [
    '-re', '-i', 'pipe:0',
    '-acodec', 'libopus',
    '-f', 'ogg',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1',
    '-loglevel', 'quiet'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ytdlp.on('error', () => ffmpeg.kill());
  ffmpeg.on('error', () => ytdlp.kill());

  const kill = () => {
    try { ytdlp.kill(); } catch (_) {}
    try { ffmpeg.kill(); } catch (_) {}
  };
  return { stream: ffmpeg.stdout, kill };
}

async function resolveQuery(query) {
  const isUrl = /^https?:\/\//.test(query.trim());
  if (isUrl) {
    const proc = spawn('yt-dlp', [
      '--print', '%(title)s',
      '--print', '%(url)s',
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      ...YT_EXTRACTOR_ARGS,
      query.trim()
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', c => { stderr += c; });

    const out = await new Promise((resolve, reject) => {
      let data = '';
      proc.stdout.on('data', c => data += c);
      proc.on('close', (code) => {
        if (code !== 0) {
          const msg = stderr.trim() || 'Failed to get video info';
          reject(new Error(msg.split('\n').pop().replace(/^ERROR: /, '').slice(0, 200)));
        } else {
          resolve(data.trim());
        }
      });
      proc.on('error', reject);
    });

    const lines = out.split('\n').filter(Boolean);
    if (!lines.length) return null;
    return { title: lines[0] || 'Unknown', url: lines[1] || query.trim() };
  }

  const args = [
    'ytsearch1:' + query,
    '--print', '%(title)s',
    '--print', '%(url)s',
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    ...YT_EXTRACTOR_ARGS
  ];
  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let stderr = '';
  proc.stderr.on('data', c => { stderr += c; });

  const out = await new Promise((resolve, reject) => {
    let data = '';
    proc.stdout.on('data', c => data += c);
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = stderr.trim() || 'Search failed (YouTube may be blocking requests). Try a direct URL.';
        reject(new Error(msg.split('\n').pop().replace(/^ERROR: /, '').slice(0, 200)));
      } else {
        resolve(data.trim());
      }
    });
    proc.on('error', reject);
  });

  const lines = out.split('\n').filter(Boolean);
  if (!lines.length) return null;
  return { title: lines[0] || 'Unknown', url: lines[1] };
}

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
    currentKill: null,
    textChannel,
    voiceChannel
  };
  queues.set(guildId, queue);

  player.on(AudioPlayerStatus.Idle, () => {
    if (queue.currentKill) {
      queue.currentKill();
      queue.currentKill = null;
    }
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
    if (queue.currentKill) {
      queue.currentKill();
      queue.currentKill = null;
    }
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
    const { stream, kill } = createYtDlpStream(track.url);
    q.currentKill = kill;
    const resource = createAudioResource(stream, { inputType: StreamType.OggOpus });
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
    const info = await resolveQuery(query);
    if (!info) return { found: false, msg: 'No results found.' };
    const track = { title: info.title || 'Unknown', url: info.url };

    if (q.player.state.status === AudioPlayerStatus.Idle && !q.current) {
      q.current = track;
      const { stream, kill } = createYtDlpStream(track.url);
      q.currentKill = kill;
      const resource = createAudioResource(stream, { inputType: StreamType.OggOpus });
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

function shutdown() {
  for (const [guildId, q] of queues) {
    if (q.currentKill) q.currentKill();
    q.connection.destroy();
  }
  queues.clear();
}

module.exports = { addTrack, skip, stop, pause, resume, getQueue, shutdown };
