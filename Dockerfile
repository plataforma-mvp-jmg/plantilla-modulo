# Imagen homologada del módulo: build en una etapa, runtime sin herramientas de desarrollo y sin root.
FROM node:26-alpine AS build
# Node 25+ ya no incluye corepack: se instala en versión fija y pnpm sale de "packageManager".
RUN npm install -g corepack@0.36.0 && corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:26-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY --from=build /src/package.json /src/modulo.yaml ./
# Migraciones: las aplica `node dist/migrar.js` (lo corre el deployer antes del corte).
COPY --from=build /src/migraciones ./migraciones
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/server.js"]
