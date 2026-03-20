FROM node:20-slim AS base
WORKDIR /app

# Backend deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Frontend build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci 2>/dev/null || cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Backend source
COPY tsconfig.json ./
COPY src/ ./src/

# Serve frontend static files from backend
# (frontend/dist will be served by express static middleware)

RUN adduser --disabled-password --gecos '' agent
RUN mkdir -p logs && chown agent:agent logs
USER agent

EXPOSE 3001

CMD ["npx", "tsx", "src/web/server.ts"]
