FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates debian-keyring curl gnupg \
 && curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/caddy.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy.list \
 && apt-get update && apt-get install -y --no-install-recommends caddy && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN corepack enable
COPY . .
RUN npm ci && npm run build && npx next build examples/next-app --webpack
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
CMD ["sh", "-c", "caddy start --config docker/Caddyfile && exec npx next start examples/next-app -p 3000 -H 0.0.0.0"]
