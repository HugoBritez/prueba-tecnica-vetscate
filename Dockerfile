FROM node:20-alpine AS base

RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM base AS build
ENV NODE_ENV=production
RUN npm ci
COPY . .
RUN npm run build && npm prune --production

FROM node:20-alpine AS production
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /usr/src/app/package*.json ./

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]