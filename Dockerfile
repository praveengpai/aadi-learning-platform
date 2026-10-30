# AADI Platform — one image runs either the cloud core or a centre hub.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY core ./core
COPY modules ./modules
COPY public ./public
COPY scripts ./scripts
COPY server.js CONTRACT.md ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/api/core/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
