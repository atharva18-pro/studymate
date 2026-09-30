FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

EXPOSE 3000
CMD ["node", "server/index.js"]
