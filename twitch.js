/**
 * Twitch Helix API integration module
 * Handles OAuth token management, stream data fetching, and stream status polling
 */

let accessToken = null;
let tokenExpiresAt = null;
let logger = (level, message) => {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [Twitch/${level.toUpperCase()}]`;
  if (level === 'error') console.error(prefix, message);
  else console.log(prefix, message);
};

function setLogger(fn) {
  if (typeof fn === 'function') logger = fn;
}

const TWITCH_API_BASE = 'https://api.twitch.tv/helix';

function handleApiError(response, body) {
  if (response.status === 401) throw new Error('Twitch API: Invalid or expired token (check CLIENT_ID and CLIENT_SECRET)');
  if (response.status === 429) throw new Error('Twitch API: Rate limit exceeded');
  throw new Error(`Twitch API error: ${response.status} ${body}`);
}

/**
 * Get OAuth app access token (or refresh if expired)
 */
async function getAccessToken(clientId, clientSecret) {
  const now = Date.now();
  if (accessToken && tokenExpiresAt && tokenExpiresAt > now + 60000) {
    return accessToken;
  }

  const url = 'https://id.twitch.tv/oauth2/token';
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const response = await fetch(`${url}?${params}`, { method: 'POST' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twitch OAuth failed: ${data.message || JSON.stringify(data)}`);
  }

  accessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in * 1000);
  logger('info', 'Twitch OAuth token refreshed');
  return accessToken;
}

/**
 * Fetch stream data for given usernames
 */
async function getStreams(clientId, clientSecret, usernames) {
  if (!usernames || usernames.length === 0) {
    return [];
  }

  const token = await getAccessToken(clientId, clientSecret);

  const params = new URLSearchParams();
  usernames.forEach(u => params.append('user_login', u));

  const response = await fetch(`${TWITCH_API_BASE}/streams?${params}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.text();
    handleApiError(response, err);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch user IDs for usernames (needed for game lookup)
 */
async function getUsers(clientId, clientSecret, usernames) {
  if (!usernames || usernames.length === 0) {
    return [];
  }

  const token = await getAccessToken(clientId, clientSecret);

  const params = new URLSearchParams();
  usernames.forEach(u => params.append('login', u));

  const response = await fetch(`${TWITCH_API_BASE}/users?${params}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.text();
    handleApiError(response, err);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch game names by game IDs
 */
async function getGames(clientId, clientSecret, gameIds) {
  if (!gameIds || gameIds.length === 0) {
    return new Map();
  }

  const token = await getAccessToken(clientId, clientSecret);

  const params = new URLSearchParams();
  gameIds.forEach(id => params.append('id', id));

  const response = await fetch(`${TWITCH_API_BASE}/games?${params}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.text();
    handleApiError(response, err);
  }

  const data = await response.json();
  const map = new Map();
  (data.data || []).forEach(g => map.set(g.id, g.name));
  return map;
}

/**
 * Build full stream info (stream + game name) for given stream data
 */
async function getStreamInfo(clientId, clientSecret, stream) {
  const gameIds = stream.game_id ? [stream.game_id] : [];
  const games = await getGames(clientId, clientSecret, gameIds);
  return {
    id: stream.id,
    user_id: stream.user_id,
    user_login: stream.user_login,
    user_name: stream.user_name,
    title: stream.title || 'Untitled Broadcast',
    game_id: stream.game_id,
    game_name: games.get(stream.game_id) || 'Unknown',
    viewer_count: stream.viewer_count || 0,
    thumbnail_url: stream.thumbnail_url || '',
    started_at: stream.started_at
  };
}

/**
 * Build stream infos for multiple streams in one batch (single getGames call)
 */
async function getStreamInfos(clientId, clientSecret, streams) {
  if (!streams || streams.length === 0) return [];
  const gameIds = [...new Set(streams.map(s => s.game_id).filter(Boolean))];
  const games = await getGames(clientId, clientSecret, gameIds);
  return streams.map(stream => ({
    id: stream.id,
    user_id: stream.user_id,
    user_login: stream.user_login,
    user_name: stream.user_name,
    title: stream.title || 'Untitled Broadcast',
    game_id: stream.game_id,
    game_name: games.get(stream.game_id) || 'Unknown',
    viewer_count: stream.viewer_count || 0,
    thumbnail_url: stream.thumbnail_url || '',
    started_at: stream.started_at
  }));
}

module.exports = {
  getAccessToken,
  getStreams,
  getUsers,
  getGames,
  getStreamInfo,
  getStreamInfos,
  setLogger
};
