# Build from the monorepo root; runtime secrets are supplied at deployment.
ARG APP=ui
ARG WORKSPACE=@repo/ui

FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

FROM base AS prepare
ARG WORKSPACE
RUN pnpm add --global turbo@2.7.6
COPY . .
RUN test ! -d .scratch && test ! -d .git && test ! -d node_modules
# Materialize generated schema types before pruning the UI workspace.
RUN rm -rf packages/strapi-types/generated && \
    mkdir -p packages/strapi-types/generated && \
    cp apps/strapi/types/generated/*.d.ts packages/strapi-types/generated/
RUN turbo prune ${WORKSPACE} --docker

FROM base AS builder
ARG APP
ARG WORKSPACE
COPY --from=prepare /app/out/json/ .
# Turbo 2.7 can omit auto-installed peer snapshots from its pruned lockfile.
# Keep the checked lockfile and matching patch configuration; install only
# the workspace manifests selected by prune.
COPY --from=prepare /app/package.json /app/pnpm-lock.yaml ./
COPY --from=prepare /app/patches/ ./patches/
COPY --from=prepare /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN --mount=type=cache,id=ui-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=prepare /app/out/full/ .
ENV NEXT_OUTPUT=standalone
ENV NEXT_TELEMETRY_DISABLED=1
# This dummy value exists only in the builder; the runtime needs a real secret.
ENV BETTER_AUTH_SECRET=dummy-build-secret-not-for-runtime
ARG NEXT_PUBLIC_FORCE_LIGHT_THEME=false
ARG APP_PUBLIC_URL=https://libraries.global
ARG NEXT_PUBLIC_STRAPI_URL=https://cms.libraries.global
ARG IMAGE_REMOTE_HOSTS=libraries-global-production-media.lon1.cdn.digitaloceanspaces.com
ENV APP_PUBLIC_URL=${APP_PUBLIC_URL}
ENV NEXT_PUBLIC_STRAPI_URL=${NEXT_PUBLIC_STRAPI_URL}
ENV NEXT_PUBLIC_FORCE_LIGHT_THEME=${NEXT_PUBLIC_FORCE_LIGHT_THEME}
ENV IMAGE_REMOTE_HOSTS=${IMAGE_REMOTE_HOSTS}
RUN pnpm exec turbo run build --filter=${WORKSPACE}
RUN test -f apps/${APP}/.next/standalone/apps/${APP}/server.js

# Match the builder's libc for traced native dependencies.
FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runner
ARG APP
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/${APP}/.next/standalone/ ./
COPY --from=builder --chown=node:node /app/apps/${APP}/.next/static/ ./apps/${APP}/.next/static/
COPY --from=builder --chown=node:node /app/apps/${APP}/public/ ./apps/${APP}/public/
USER node
WORKDIR /app/apps/${APP}
EXPOSE 3000
CMD ["node", "server.js"]
