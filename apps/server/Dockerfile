# API サーバーと管理画面。リポジトリの最上位を build の起点にする（docker build -f apps/server/Dockerfile .）

# 管理画面（apps/web）を組み立てる
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @kikitori/web --no-audit --no-fund
COPY packages/protocol packages/protocol
COPY apps/web apps/web
RUN npm run build -w @kikitori/web

# API サーバー。Node 24 は型を消すだけで .ts をそのまま動かせる（サーバーにはビルドの段を持たない）
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @kikitori/server --no-audit --no-fund
COPY packages/protocol packages/protocol
COPY apps/server/src apps/server/src
COPY --from=web /app/apps/web/dist apps/web/dist

ENV KIKITORI_HOST=0.0.0.0 \
    KIKITORI_PORT=8780 \
    KIKITORI_DATABASE_PATH=/data/kikitori.db \
    KIKITORI_WEB_DIRECTORY=/app/apps/web/dist
EXPOSE 8780
USER node
CMD ["node", "apps/server/src/main.ts"]
