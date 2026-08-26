# Aurelius backend — the always-on spine (Railway / any container host).
# One process: Express + schedulers + Telegram long-polling. DB is Neon
# (external), so this image carries no database — just node, tsx, and
# postgresql-client for the nightly pg_dump backups.
FROM node:22-slim

# postgresql-client for the nightly pg_dump backup. Debian's DEFAULT package is
# v15, but Neon runs Postgres 16/17 — and pg_dump refuses to dump a server newer
# than itself ("server version … pg_dump version … aborting"), which failed the
# 02:00 backup every single night. Install v17 from the official PGDG repo (a
# newer client dumps any older server), so the backup works whatever major Neon
# is on. Codename is derived from the base image so a node-slim bump can't break
# the repo line.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg openssl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-17 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching. Full install (not --omit=dev): tsx is
# the runtime — omitting dev deps made npx re-download it on every container
# start (pre-flight council blocker).
COPY package*.json ./
RUN npm ci

COPY . .

# Prisma client for the runtime platform.
RUN npx prisma generate

# Railway injects PORT; the backup dir is a mounted volume in production.
ENV NODE_ENV=production
EXPOSE 3001

# migrate deploy first: a no-op when Neon is current, and the reason future
# schema changes can't drift the live DB (remember the DROP INDEX gotcha
# belongs at migration-authoring time, not here).
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx index.ts"]
