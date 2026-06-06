# Server de push (Node + Hono + firebase-admin). Imagen portable: sirve en
# Fly.io, Render, Railway, Cloud Run o cualquier host de contenedores.
#
# El contexto de build debe ser la RAÍZ del monorepo (necesita pnpm-workspace).
# Construir desde la raíz:
#   docker build -f apps/server/Dockerfile -t yapi-server .
#   docker run -p 3001:3001 --env-file apps/server/.env yapi-server

# ---------- builder ----------
FROM node:20-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# Copiamos todo el monorepo (el .dockerignore deja fuera node_modules/dist/etc.)
COPY . .

# Instala solo el server y sus dependencias del workspace (no mobile/worker).
RUN pnpm install --frozen-lockfile --filter @yapi/server...

# Compila a dist/ (tsup inlinea los paquetes @yapi/* del workspace).
RUN pnpm --filter @yapi/server build

# Genera un paquete autocontenido (package.json + dist + node_modules de prod).
# --legacy: en pnpm v10 el deploy sin inyección de paquetes lo requiere; no
# importa porque tsup ya inlinó los @yapi/* en dist (runtime solo usa deps npm).
RUN pnpm --filter=@yapi/server deploy --prod --legacy /app

# ---------- runtime ----------
FROM node:20-slim AS runtime
ENV NODE_ENV=production
# El PaaS suele inyectar PORT; por defecto 3001 (el server lo respeta).
ENV PORT=3001
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3001
CMD ["node", "dist/index.js"]
