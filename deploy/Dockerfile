# Built from the staging folder that deploy.mjs assembles (server.mjs plus public/), not from the repo root.
FROM node:22-slim
WORKDIR /app
COPY server.mjs datastore.mjs ./
COPY public ./public
ENV NODE_ENV=production
USER node
CMD ["node", "server.mjs"]
