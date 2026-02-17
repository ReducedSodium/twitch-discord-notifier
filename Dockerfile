FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install with --omit=dev (avoids deprecated --production warning)
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY . .

# Don't run as root
USER node

CMD ["node", "index.js"]
