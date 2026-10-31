# Build from the repository root. Events and Atlas use the same image with
# separate commands: dist/index.js and dist/atlas/index.js.
FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

FROM base AS prepare
RUN pnpm add --global turbo@2.7.6
COPY . .
RUN test ! -d .scratch && test ! -d .git && test ! -d node_modules && test ! -d apps/ui
RUN turbo prune @repo/sync-worker --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=prepare /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN --mount=type=cache,id=worker-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=prepare /app/out/full/ .
RUN pnpm exec turbo run build --filter=@repo/sync-worker
RUN pnpm --filter @repo/sync-worker deploy --legacy --prod --ignore-scripts /opt/worker

FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /opt/worker/ .
USER node
EXPOSE 3100 3101
CMD ["node", "dist/index.js"]
