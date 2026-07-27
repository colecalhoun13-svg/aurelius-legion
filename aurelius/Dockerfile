# Aurelius backend — the always-on spine (Railway / any container host).
# One process: Express + schedulers + Telegram long-polling. DB is Neon
# (external), so this image carries no database — just node, tsx, and
# postgresql-client for the nightly pg_dump backups.
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Prisma client for the runtime platform.
RUN npx prisma generate

# Railway injects PORT; the backup dir is a mounted volume in production.
ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "tsx", "index.ts"]
