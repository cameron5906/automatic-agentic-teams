# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3

COPY --from=builder /app/dist ./dist

RUN mkdir -p /data && chown -R node:node /data
VOLUME /data

USER node

ENV NODE_ENV=production
ENV BOT_SQLITE_PATH=/data/business-bot.sqlite

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
