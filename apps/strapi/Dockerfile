# Build from the monorepo root. Credentials and uploads are runtime inputs.
ARG APP=strapi
ARG WORKSPACE=@repo/strapi

FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
ENV STRAPI_TELEMETRY_DISABLED=true
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

FROM base AS prepare
ARG WORKSPACE
RUN pnpm add --global turbo@2.7.6
COPY . .
RUN test ! -d .scratch && test ! -d .git && test ! -d node_modules
RUN turbo prune ${WORKSPACE} --docker

FROM base AS builder
# The admin/editor bundle exceeds Node's default 2 GiB build heap.
ENV NODE_OPTIONS=--max-old-space-size=4096
ARG APP
ARG WORKSPACE
COPY --from=prepare /app/out/json/ .
# Keep every locked peer snapshot and its matching patch configuration.
# The pruned workspace manifests still limit which packages are installed.
COPY --from=prepare /app/package.json /app/pnpm-lock.yaml ./
COPY --from=prepare /app/patches/ ./patches/
COPY --from=prepare /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN --mount=type=cache,id=cms-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=prepare /app/out/full/ .
RUN pnpm exec turbo run build --filter=${WORKSPACE}
# pnpm prune does not support monorepos; deploy creates isolated production deps.
RUN pnpm --filter ${WORKSPACE} deploy --legacy --prod --ignore-scripts /opt/cms && \
    mkdir -p /opt/cms/dist /opt/cms/src/plugins && \
    cp -a apps/${APP}/dist/. /opt/cms/dist/ && \
    cp -a apps/${APP}/src/plugins/. /opt/cms/src/plugins/ && \
    test -f /opt/cms/node_modules/@strapi/strapi/bin/strapi.js && \
    test -f /opt/cms/src/plugins/events/dist/server/index.js && \
    test -f /opt/cms/src/plugins/content-moderation/dist/server/index.js

FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runner
ENV NODE_ENV=production
ENV STRAPI_TELEMETRY_DISABLED=true
ENV HOST=0.0.0.0
ENV PORT=1337
WORKDIR /app
COPY --from=builder --chown=node:node /opt/cms/ ./
USER node
EXPOSE 1337
CMD ["node", "./node_modules/@strapi/strapi/bin/strapi.js", "start"]
