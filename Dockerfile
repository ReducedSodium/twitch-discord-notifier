FROM node:20-slim

# FFmpeg + yt-dlp for music (yt-dlp bypasses YouTube bot detection)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg curl ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./

# Install with --omit=dev (avoids deprecated --production warning)
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY . .

# Ensure node user can write config.json (for slash commands)
RUN chown -R node:node /app

USER node

CMD ["node", "index.js"]
