FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY shared/package.json shared/package.json
COPY browser-engine/package.json browser-engine/package.json
RUN npm ci
COPY . .
RUN npm run build -w @profilex/shared && npm run build -w @profilex/backend
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY shared/package.json shared/package.json
COPY browser-engine/package.json browser-engine/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/migrations apps/backend/migrations
COPY --from=build /app/shared/dist shared/dist
EXPOSE 4387
CMD ["node", "apps/backend/dist/index.js"]
