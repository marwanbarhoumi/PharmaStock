# PharmaStock Sales Service
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S pharma && adduser -S pharma -G pharma
COPY --from=build --chown=pharma:pharma /app/package.json /app/package-lock.json ./
COPY --from=build --chown=pharma:pharma /app/node_modules ./node_modules
COPY --from=build --chown=pharma:pharma /app/dist ./dist
USER pharma
EXPOSE 5006
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5006/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
