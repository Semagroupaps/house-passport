# Single-stage build på Debian-slim — enklest og mest robust ift. Prisma-engine.
FROM node:20-slim

# openssl + ca-certificates: nødvendige for Prisma-engine og HTTPS-downloads
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installér ALLE afhængigheder (inkl. dev) — TypeScript/Prisma bruges til build.
# NB: NODE_ENV sættes FØRST efter build, ellers springer npm ci devDeps over.
COPY package*.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000

# Kopiér kildekode og byg
COPY . .
RUN npx prisma generate && npm run build && chmod +x entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "/app/entrypoint.sh"]
