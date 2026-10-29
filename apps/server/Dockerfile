# API サーバー。リポジトリの最上位を build の起点にする（docker build -f apps/server/Dockerfile .）
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --workspace @kikitori/server --no-audit --no-fund
COPY packages/protocol packages/protocol
COPY apps/server/src apps/server/src

ENV KIKITORI_HOST=0.0.0.0 \
    KIKITORI_PORT=8780 \
    KIKITORI_DATABASE_PATH=/data/kikitori.db
EXPOSE 8780
USER node
# Node 24 は型を消すだけで .ts をそのまま動かせる（ビルドの段を持たない）
CMD ["node", "apps/server/src/main.ts"]
